import FieldFollowUpPanel from "../components/follow-ups/FieldFollowUpPanel";
import NodalFollowUpPanel from "../components/follow-ups/NodalFollowUpPanel";
import { useIsFieldRole } from "../lib/session";

/**
 * `/follow-ups` is one route with two audiences.
 *
 * ANM and CHO get the personal three-track panel. Block and district staff get
 * the shared line list with attribution and the status audit dropdown.
 */
export default function FollowUpsPage() {
  const fieldRole = useIsFieldRole();
  return fieldRole ? <FieldFollowUpPanel /> : <NodalFollowUpPanel />;
}
