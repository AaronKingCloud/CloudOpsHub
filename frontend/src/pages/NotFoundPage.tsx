import { Link } from "react-router";

function NotFoundPage() {
  return (
    <section className="panel empty-page">
      <h2>Page not found</h2>
      <p className="state-message">This page doesn't exist.</p>
      <Link to="/" className="btn">
        Back to Overview
      </Link>
    </section>
  );
}

export default NotFoundPage;
