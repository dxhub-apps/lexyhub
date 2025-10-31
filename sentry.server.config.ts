import { buildSentryOptions } from "./sentry.options";

const options = buildSentryOptions("server");

export default options;
export { options as serverSentryOptions };
