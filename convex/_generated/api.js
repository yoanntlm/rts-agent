// Runtime-safe fallback for development before full Convex codegen has run.
// `convex codegen` will replace this with a typed API surface.
const functionName = Symbol.for("functionName");

function createApi(pathParts = []) {
  return new Proxy(
    {},
    {
      get(_, prop) {
        if (typeof prop === "string") {
          return createApi([...pathParts, prop]);
        }
        if (prop === functionName) {
          if (pathParts.length < 2) {
            const found = ["api", ...pathParts].join(".");
            throw new Error(
              `API path is expected to be of the form \`api.moduleName.functionName\`. Found: \`${found}\``,
            );
          }
          const path = pathParts.slice(0, -1).join("/");
          const exportName = pathParts[pathParts.length - 1];
          return exportName === "default" ? path : `${path}:${exportName}`;
        }
        if (prop === Symbol.toStringTag) return "FunctionReference";
        return undefined;
      },
    },
  );
}

const anyApi = createApi();

export const api = anyApi;
export const internal = anyApi;
