// PLACEHOLDER — overwritten by `npx convex dev` (run from /convex/).
const placeholderError = () => {
  throw new Error(
    "Convex API not generated yet. Run `npx convex dev` from /convex/ to create a deployment and generate the API.",
  );
};
const proxy = new Proxy(
  {},
  {
    get: () =>
      new Proxy({}, { get: () => placeholderError }),
  },
);
export const api = proxy;
export const internal = proxy;
