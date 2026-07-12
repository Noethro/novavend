export default function StatusPage() {
  return (
    <main className="grid min-h-screen place-content-center gap-3 p-8">
      <p className="text-sm font-semibold tracking-widest text-emerald-300 uppercase">
        Development preview — frontend only
      </p>
      <h1 className="text-4xl font-bold">NovaVend preview is available</h1>
      <p className="text-emerald-100/75">
        This static page does not indicate API, database, authentication, or
        commerce availability.
      </p>
    </main>
  );
}
