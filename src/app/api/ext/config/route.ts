export { GET } from "../remote-config/route";

// Next.js requires runtime hints to be defined as literals on each route
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
