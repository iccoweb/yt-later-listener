import { describe, expect, it } from "vite-plus/test";
import { extractVideoId } from "./youtube";

describe("extractVideoId", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL123", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://music.youtube.com/watch?v=dQw4w9WgXcQ&feature=share", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?si=abcdef", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/live/dQw4w9WgXcQ?feature=share", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["Check this out https://youtu.be/dQw4w9WgXcQ via YouTube", "dQw4w9WgXcQ"],
  ])("accepts %s", (input, expected) => {
    expect(extractVideoId(input)).toBe(expected);
  });

  it.each([
    "https://evil.example.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
    "https://user:pass@youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com:8443/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=short",
    "https://www.youtube.com/playlist?list=PL123",
    "https://www.youtube.com/@channel",
    "file:///etc/passwd",
    "--exec rm",
    "",
  ])("rejects %s", (input) => {
    expect(extractVideoId(input)).toBeNull();
  });
});
