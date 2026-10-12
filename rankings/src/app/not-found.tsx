import { ButtonLink } from "./ui/button";
import { Screen } from "./ui/screen";

export default function NotFound() {
  return (
    <Screen code="404" title="Not found">
      <p className="text-zinc-100">There&apos;s nothing here. It may have been deleted, or the link is wrong.</p>
      <ButtonLink href="/">Back to the start</ButtonLink>
    </Screen>
  );
}
