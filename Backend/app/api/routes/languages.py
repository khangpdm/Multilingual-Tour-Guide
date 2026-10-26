from fastapi import APIRouter, HTTPException, Request

router = APIRouter(tags=["Languages"])


@router.get("/languages")
async def get_languages(request: Request):
    db = request.app.state.db

    try:
        cursor = (
            db["languages"]
            .find(
                {"is_active": True},
                {
                    "_id": 1,
                    "name": 1,
                    "native_name": 1,
                    "is_default": 1,
                    "display_order": 1,
                },
            )
            .sort("display_order", 1)
        )

        documents = await cursor.to_list(length=100)

        languages = [
            {
                "code": str(document["_id"]),
                "name": document.get("name", ""),
                "native_name": document.get("native_name", ""),
                "is_default": document.get("is_default", False),
                "display_order": document.get("display_order", 0),
            }
            for document in documents
        ]

        return {"languages": languages}

    except Exception as e:
        print(f"DEBUG ERROR: {type(e).__name__}: {e}")
        
        raise HTTPException(
            status_code=500,
            detail={
                "code": "INTERNAL_ERROR",
                "message": str(e),
            },
        )