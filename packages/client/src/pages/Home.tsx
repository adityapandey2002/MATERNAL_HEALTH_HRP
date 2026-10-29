import { useIsFieldRole } from "../lib/session";
import FieldHome from "./FieldHome";
import NodalDashboard from "./NodalDashboard";

/**
 * Role-aware front page.
 *
 * ANM and CHO open on the single Add case action. Block, district and helpdesk
 * accounts open on the block dashboard.
 */
export default function Home() {
  const fieldRole = useIsFieldRole();
  return fieldRole ? <FieldHome /> : <NodalDashboard />;
}
