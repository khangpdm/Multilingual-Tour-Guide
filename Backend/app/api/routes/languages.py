from fastapi import APIRouter, HTTPException, Request

router = APIRouter(tags=["Languages"])


@router.get("/languages")
async def get_languages(request: Request):
    db_pool = request.app.state.db_pool

    try:
        async with db_pool.acquire() as conn:
            async with conn.cursor() as cursor:
                await cursor.execute(
                    """
                    SELECT code, name, native_name, is_default, display_order 
                    FROM languages 
                    WHERE is_active = 1 
                    ORDER BY display_order ASC
                    """
                )
                rows = await cursor.fetchall()

        languages = [
            {
                "code": row[0],
                "name": row[1],
                "native_name": row[2],
                "is_default": bool(row[3]),
                "display_order": row[4],
            }
            for row in rows
        ]

        return {"languages": languages}

    except Exception as e:
        print(f"DEBUG ERROR: {type(e).__name__}: {e}")
        
        raise HTTPException(
            status_code=500,
            detail={
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "An internal error occurred",
                }
            },
        )