import { describe, expect, it } from "vitest";
import { commentRepo, REPO_FULL_NAME } from "./blog-config";

const base = { githubName: "someone", githubRepo: "blog" };

describe("commentRepo", () => {
  it("uses githubName/githubRepo when CommentRepo is missing", () => {
    expect(commentRepo(base)).toBe("someone/blog");
  });

  it("uses githubName/githubRepo when CommentRepo is empty or only spaces", () => {
    expect(commentRepo({ ...base, CommentRepo: "" })).toBe("someone/blog");
    expect(commentRepo({ ...base, CommentRepo: "   " })).toBe("someone/blog");
  });

  it("uses CommentRepo when it is set", () => {
    expect(commentRepo({ ...base, CommentRepo: "someone/old-blog" })).toBe("someone/old-blog");
  });

  it("trims CommentRepo", () => {
    expect(commentRepo({ ...base, CommentRepo: " someone/old-blog " })).toBe("someone/old-blog");
  });
});

describe("REPO_FULL_NAME", () => {
  it("accepts owner/name", () => {
    for (const name of ["someone/blog", "some-one/nuxt-blog", "a_b/c.d"]) {
      expect(REPO_FULL_NAME.test(name)).toBe(true);
    }
  });

  it("rejects other formats", () => {
    for (const name of ["blog", "someone/", "/blog", "someone/blog/x", "https://github.com/someone/blog", "some one/blog"]) {
      expect(REPO_FULL_NAME.test(name)).toBe(false);
    }
  });
});
