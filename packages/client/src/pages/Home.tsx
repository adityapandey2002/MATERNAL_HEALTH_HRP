import { useIsDistrictRole, useIsFieldRole } from "../lib/session";
import DistrictDashboard from "./DistrictDashboard";
import FieldHome from "./FieldHome";
import NodalDashboard from "./NodalDashboard";

/**
 * Role-aware front page.
 *
 * ANM and CHO open on the single Add case action, block roles open on the block
 * dashboard and district roles on the district roll-up with escalations.
 */
export default function Home() {
  const fieldRole = useIsFieldRole();
  const districtRole = useIsDistrictRole();

  if (districtRole) return <DistrictDashboard />;
  return fieldRole ? <FieldHome /> : <NodalDashboard />;
}
