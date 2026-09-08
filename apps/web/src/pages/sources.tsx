import { useAuth } from "@clerk/react";
import { SourceCollection } from "../features/sources/source-collection";
export default function SourcesPage() {
  const { userId } = useAuth();
  return <SourceCollection key={userId} />;
}
