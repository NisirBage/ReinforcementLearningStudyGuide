import { Link, useLocation } from "react-router-dom";
import { PageTitle } from "../components/ui";

export function NotFound() {
  const loc = useLocation();
  return (
    <>
      <PageTitle title="Not found">Page not found</PageTitle>
      <p className="muted">
        There is no page at <code>{loc.pathname}</code>.
      </p>
      <p>
        <Link to="/">Go to the home page</Link> or <Link to="/search">search</Link>.
      </p>
    </>
  );
}
