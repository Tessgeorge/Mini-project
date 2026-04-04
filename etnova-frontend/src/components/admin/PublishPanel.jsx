import SectionCard from "./SectionCard";

export default function PublishPanel({ verificationStatus = "Verification Completed", onPublishClick }) {
  return (
    <SectionCard title="Result Publishing Panel">
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-lg bg-teal-50 text-teal-700 px-3 py-2 text-sm font-medium">
          <span className="size-2 rounded-full bg-teal-600" />
          {verificationStatus}
        </div>
        <button
          type="button"
          onClick={onPublishClick}
          className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-colors"
        >
          Approve &amp; Publish Results
        </button>
        <p className="text-sm text-amber-700">Publishing will lock marks</p>
      </div>
    </SectionCard>
  );
}
