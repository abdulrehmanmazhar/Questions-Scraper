export function getPageType(
  url: string,
): "main" | "home" | "create test" | "test" | "overview" | "unknown" {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, ""); // strip trailing slash
    const segments = path.split("/").filter(Boolean); // remove empty segments

    // https://app2.canadaqbank.com  or  https://app2.canadaqbank.com/
    if (segments.length === 0) {
      return "main";
    }

    // /member/auth/login

    if (
      segments.length === 3 &&
      segments[0] === "member" &&
      segments[1] === "auth" &&
      segments[2] === "login"
    ) {
      return "main";
    }

    // /member/home
    if (
      segments.length === 2 &&
      segments[0] === "member" &&
      segments[1] === "home"
    ) {
      return "home";
    }

    // /member/qbank/overview
    if (
      segments.length === 3 &&
      segments[0] === "member" &&
      segments[1] === "qbank" &&
      segments[2] === "overview"
    ) {
      return "overview";
    }

    // /member/qbank//test/create  (note the double slash collapses with filter(Boolean))
    if (
      segments.length === 4 &&
      segments[0] === "member" &&
      segments[1] === "qbank" &&
      segments[2] === "test" &&
      segments[3] === "create"
    ) {
      return "create test";
    }

    // /member/qbank/test?id=...
    if (
      segments.length === 3 &&
      segments[0] === "member" &&
      segments[1] === "qbank" &&
      segments[2] === "test"
    ) {
      return "test";
    }

    return "unknown";
  } catch {
    return "unknown";
  }
}
