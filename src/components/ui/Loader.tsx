interface LoaderProps {
  /** Override the fill/border colour — use for dark backgrounds */
  color?: string;
}

export function Loader({ color }: LoaderProps) {
  return <div className="loader" style={color ? { color } : undefined} />;
}

/** Centres the loader inside a full-screen page (auth guards, route transitions) */
export function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader />
    </div>
  );
}

/** Centres the loader with vertical padding — drop inside cards / table cells */
export function InlineLoader({ color }: LoaderProps) {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader color={color} />
    </div>
  );
}
