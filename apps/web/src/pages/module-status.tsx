import { Navigate, useParams } from "react-router-dom";

export default function ModuleStatusPage() {
  const { moduleId } = useParams();
  return (
    <Navigate
      replace
      to={moduleId ? `/modules/new?moduleId=${encodeURIComponent(moduleId)}` : "/modules"}
    />
  );
}
