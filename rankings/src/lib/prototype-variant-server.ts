import "server-only";
import { headers } from "next/headers";
import { parseVariant, VARIANT_HEADER, type Variant } from "./prototype-variant";

/** PROTOTYPE: the visual direction to render, as the proxy resolved it from `?variant=` or the cookie. */
export async function readVariant(): Promise<Variant> {
  return parseVariant((await headers()).get(VARIANT_HEADER)) ?? "current";
}
