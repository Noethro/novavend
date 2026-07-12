import { Button } from '@novavend/ui';

export default function HomePage() {
  return (
    <main className="grid min-h-screen place-content-center gap-4 bg-[radial-gradient(circle_at_top,#123c2c,#07130f_55%)] p-8">
      <p className="text-xs font-bold tracking-[0.18em] text-emerald-300 uppercase">
        Repository bootstrap
      </p>
      <h1 className="text-6xl font-bold tracking-[-0.07em] sm:text-8xl">
        NovaVend
      </h1>
      <p className="max-w-2xl text-xl leading-relaxed text-emerald-100/75">
        A clean-room foundation for merchant commerce experiences in Second
        Life.
      </p>
      <Button disabled>Business capabilities arrive in later tasks</Button>
    </main>
  );
}
