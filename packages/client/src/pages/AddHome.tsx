import { Link } from "react-router-dom";
import { PlusIcon } from "../components/ui/Icons";

export default function AddHome() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <h1 className="sr-only">Add</h1>
      <Link
        to="/patients/new"
        aria-label="Add HRP woman"
        className="flex h-48 w-48 items-center justify-center rounded-full bg-green-700 text-white shadow-xl transition hover:scale-105 hover:bg-green-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-300"
      >
        <PlusIcon className="h-24 w-24" />
      </Link>
    </div>
  );
}
