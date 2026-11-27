from __future__ import annotations

import copy
import json
import threading
import uuid
from pathlib import Path
from typing import Any

from pymongo import MongoClient
from pymongo.errors import PyMongoError

from .config import MONGODB_DB, MONGODB_TIMEOUT_MS, MONGODB_URI, STORE_DIR


def _matches_filter(doc: dict[str, Any], filt: dict[str, Any] | None) -> bool:
    if not filt:
        return True
    for key, expected in filt.items():
        val = doc.get(key)
        if isinstance(expected, dict):
            for op, target in expected.items():
                if op == "$eq" and val != target:
                    return False
                elif op == "$ne" and val == target:
                    return False
                elif op == "$in" and val not in target:
                    return False
                elif op == "$nin" and val in target:
                    return False
                elif op == "$gte" and (val is None or val < target):
                    return False
                elif op == "$gt" and (val is None or val <= target):
                    return False
                elif op == "$lte" and (val is None or val > target):
                    return False
                elif op == "$lt" and (val is None or val < target):
                    return False
        else:
            if val != expected:
                return False
    return True


class LocalCollection:
    """Thread-safe JSON-backed collection with PyMongo-compatible subset API."""

    def __init__(self, name: str, path: Path) -> None:
        self.name = name
        self.path = path
        self._lock = threading.RLock()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._docs: list[dict[str, Any]] = self._load()

    def _load(self) -> list[dict[str, Any]]:
        if not self.path.exists():
            return []
        try:
            with self.path.open("r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, list) else []
        except (json.JSONDecodeError, OSError):
            return []

    def _persist(self) -> None:
        tmp = self.path.with_suffix(".tmp")
        with tmp.open("w", encoding="utf-8") as f:
            json.dump(self._docs, f, indent=2, default=str)
        tmp.replace(self.path)

    def count_documents(self, filt: dict[str, Any] | None = None) -> int:
        with self._lock:
            if not filt:
                return len(self._docs)
            return sum(1 for d in self._docs if _matches_filter(d, filt))

    def find(
        self,
        filt: dict[str, Any] | None = None,
        sort_by: tuple[str, int] | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        with self._lock:
            results = [copy.deepcopy(d) for d in self._docs if _matches_filter(d, filt)]
            if sort_by:
                field, direction = sort_by
                results.sort(key=lambda x: (x.get(field) is None, x.get(field, "")), reverse=(direction < 0))
            if limit is not None and limit > 0:
                results = results[:limit]
            return results

    def find_one(self, filt: dict[str, Any] | None = None) -> dict[str, Any] | None:
        with self._lock:
            for d in self._docs:
                if _matches_filter(d, filt):
                    return copy.deepcopy(d)
            return None

    def insert_one(self, doc: dict[str, Any]) -> str:
        with self._lock:
            item = copy.deepcopy(doc)
            if "_id" not in item:
                item["_id"] = str(uuid.uuid4())
            self._docs.append(item)
            self._persist()
            return str(item["_id"])

    def insert_many(self, docs: list[dict[str, Any]]) -> int:
        with self._lock:
            for doc in docs:
                item = copy.deepcopy(doc)
                if "_id" not in item:
                    item["_id"] = str(uuid.uuid4())
                self._docs.append(item)
            self._persist()
            return len(docs)

    def update_one(
        self,
        filt: dict[str, Any],
        update: dict[str, Any],
        upsert: bool = False,
    ) -> bool:
        with self._lock:
            for idx, d in enumerate(self._docs):
                if _matches_filter(d, filt):
                    if "$set" in update:
                        d.update(copy.deepcopy(update["$set"]))
                    elif "$inc" in update:
                        for k, v in update["$inc"].items():
                            d[k] = d.get(k, 0) + v
                    else:
                        d.update(copy.deepcopy(update))
                    self._docs[idx] = d
                    self._persist()
                    return True
            if upsert:
                new_doc = copy.deepcopy(filt)
                if "$set" in update:
                    new_doc.update(copy.deepcopy(update["$set"]))
                else:
                    new_doc.update(copy.deepcopy(update))
                if "_id" not in new_doc:
                    new_doc["_id"] = str(uuid.uuid4())
                self._docs.append(new_doc)
                self._persist()
                return True
            return False

    def delete_many(self, filt: dict[str, Any] | None = None) -> int:
        with self._lock:
            if not filt:
                count = len(self._docs)
                self._docs = []
                self._persist()
                return count
            kept = [d for d in self._docs if not _matches_filter(d, filt)]
            removed = len(self._docs) - len(kept)
            if removed:
                self._docs = kept
                self._persist()
            return removed


class MongoCollectionAdapter:
    """Thin wrapper normalizing PyMongo Collection calls to match LocalCollection."""

    def __init__(self, col: Any) -> None:
        self._col = col

    def count_documents(self, filt: dict[str, Any] | None = None) -> int:
        return self._col.count_documents(filt or {})

    def find(
        self,
        filt: dict[str, Any] | None = None,
        sort_by: tuple[str, int] | None = None,
        limit: int | None = None,
    ) -> list[dict[str, Any]]:
        cursor = self._col.find(filt or {})
        if sort_by:
            cursor = cursor.sort(sort_by[0], sort_by[1])
        if limit is not None and limit > 0:
            cursor = cursor.limit(limit)
        docs = []
        for d in cursor:
            d["_id"] = str(d["_id"])
            docs.append(d)
        return docs

    def find_one(self, filt: dict[str, Any] | None = None) -> dict[str, Any] | None:
        doc = self._col.find_one(filt or {})
        if doc is not None:
            doc["_id"] = str(doc["_id"])
        return doc

    def insert_one(self, doc: dict[str, Any]) -> str:
        item = copy.deepcopy(doc)
        if "_id" not in item:
            item["_id"] = str(uuid.uuid4())
        res = self._col.insert_one(item)
        return str(res.inserted_id)

    def insert_many(self, docs: list[dict[str, Any]]) -> int:
        if not docs:
            return 0
        items = []
        for doc in docs:
            item = copy.deepcopy(doc)
            if "_id" not in item:
                item["_id"] = str(uuid.uuid4())
            items.append(item)
        res = self._col.insert_many(items)
        return len(res.inserted_ids)

    def update_one(
        self,
        filt: dict[str, Any],
        update: dict[str, Any],
        upsert: bool = False,
    ) -> bool:
        mod = update if ("$set" in update or "$inc" in update) else {"$set": update}
        res = self._col.update_one(filt, mod, upsert=upsert)
        return res.matched_count > 0 or res.upserted_id is not None

    def delete_many(self, filt: dict[str, Any] | None = None) -> int:
        res = self._col.delete_many(filt or {})
        return res.deleted_count


class DatabaseManager:
    """Connects to MongoDB when available and falls back to Local Document Store otherwise."""

    COLLECTIONS = (
        "menu_items",
        "ingredients",
        "meal_logs",
        "ngos",
        "surplus_items",
        "redistributions",
        "model_runs",
        "prep_plans",
        "users",
        "password_reset_otps",
    )

    def __init__(self, store_dir: Path | None = None) -> None:
        self.store_dir = store_dir or STORE_DIR
        self.backend_mode = "local_document_store"
        self.mongo_client: MongoClient | None = None
        self.mongo_db = None
        self._collections: dict[str, Any] = {}
        self._init_backend()

    def _init_backend(self) -> None:
        use_local_only = self.store_dir != STORE_DIR
        if not use_local_only:
            try:
                client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=MONGODB_TIMEOUT_MS)
                client.admin.command("ping")
                self.mongo_client = client
                self.mongo_db = client[MONGODB_DB]
                self.backend_mode = "mongodb"
                for name in self.COLLECTIONS:
                    self._collections[name] = MongoCollectionAdapter(self.mongo_db[name])
                return
            except PyMongoError:
                self.mongo_client = None
                self.mongo_db = None

        self.backend_mode = "local_document_store"
        self.store_dir.mkdir(parents=True, exist_ok=True)
        for name in self.COLLECTIONS:
            self._collections[name] = LocalCollection(name, self.store_dir / f"{name}.json")

    def collection(self, name: str) -> LocalCollection | MongoCollectionAdapter:
        if name not in self._collections:
            self._collections[name] = (
                MongoCollectionAdapter(self.mongo_db[name])
                if self.backend_mode == "mongodb" and self.mongo_db is not None
                else LocalCollection(name, self.store_dir / f"{name}.json")
            )
        return self._collections[name]

    def status(self) -> dict[str, Any]:
        counts = {name: self.collection(name).count_documents() for name in self.COLLECTIONS}
        return {
            "mode": self.backend_mode,
            "label": "MongoDB Connected" if self.backend_mode == "mongodb" else "Local Document Store (MongoDB-compatible)",
            "collections": counts,
        }


db_manager = DatabaseManager()
