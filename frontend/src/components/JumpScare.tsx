
interface JumpScareProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function JumpScare({
  isOpen,
  onClose,
}: JumpScareProps) {
  if (!isOpen) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="GhostMode distraction alert"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-red-950 text-white"
    >
      <div className="animate-bounce text-9xl">👹</div>

      <h1 className="mt-6 text-5xl font-black">
        BOO!
      </h1>

      <p className="mt-4 text-center text-xl">
        Your ghost caught you looking away!
      </p>

      <p className="mt-2 text-gray-300">
        Your study session is still running.
      </p>

      <button
        onClick={onClose}
        className="mt-8 rounded-xl bg-white px-6 py-3 font-bold text-black"
      >
        I'm back!
      </button>
    </div>
  );
}
