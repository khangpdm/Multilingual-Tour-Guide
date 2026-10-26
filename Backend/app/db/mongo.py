import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import PyMongoError

load_dotenv()

MONGODB_URL = os.getenv(
    "MONGODB_URL",
    "mongodb://127.0.0.1:27017",
)

MONGODB_DB_NAME = os.getenv(
    "MONGODB_DB_NAME",
    "tourism_db",
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    client = AsyncIOMotorClient(
        MONGODB_URL,
        serverSelectionTimeoutMS=5000,
    )

    try:
        await client.admin.command("ping")
        print(" Connected to MongoDB successfully!")
    except PyMongoError as e:
        print(f" Failed to connect to MongoDB: {e}")
        raise e

    app.state.mongo_client = client
    app.state.db = client[MONGODB_DB_NAME]

    try:
        yield
    finally:
        client.close()
        print(" Closed MongoDB connection.")