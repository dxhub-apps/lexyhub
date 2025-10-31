import { buildSentryOptions } from "./sentry.options";

const options = buildSentryOptions("edge");

export default options;
export { options as edgeSentryOptions };
