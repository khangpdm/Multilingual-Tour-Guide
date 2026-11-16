import asyncio
import edge_tts
from deep_translator import GoogleTranslator

# 1. Dịch văn bản (Anh → Việt)
text_en = "Hello, this is a test of deep translator combined with edge tts."
text_vn = GoogleTranslator(source="en", target="vi").translate(text_en)
print(f"Gốc: {text_en}")
print(f"Dịch: {text_vn}")

# 2. Chuyển thành giọng nói (giọng nữ tiếng Việt)
async def main():
    communicate = edge_tts.Communicate(
        text=text_vn,
        voice="vi-VN-HoaiMyNeural"   # nữ, tự nhiên
    )
    await communicate.save("output.mp3")
    print("Đã lưu file: output.mp3")

asyncio.run(main())   