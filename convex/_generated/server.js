// PLACEHOLDER — overwritten by `npx convex dev` (run from /convex/).
const placeholderError = () => {
  throw new Error(
    "Convex server not generated yet. Run `npx convex dev` from /convex/ to create a deployment and generate the API.",
  );
};
const fn = () => placeholderError;
export const query = fn;
export const mutation = fn;
export const action = fn;
export const internalQuery = fn;
export const internalMutation = fn;
export const internalAction = fn;
export const httpAction = fn;
