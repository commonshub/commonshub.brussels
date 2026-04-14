export default function DocsPage() {
  return (
    <div>
      <h1>Documentation</h1>
      <p className="lead text-lg text-neutral-500 mb-6">
        Commons Hub Brussels project documentation.
      </p>

      <h2>CHB CLI</h2>
      <p>
        The <code>chb</code> CLI now lives in its own repository and remains the data
        pipeline behind this site.
      </p>
      <p>
        Install and use it from{" "}
        <a href="https://github.com/commonshub/chb">
          github.com/commonshub/chb
        </a>.
      </p>
    </div>
  );
}
