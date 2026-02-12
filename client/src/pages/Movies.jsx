import { useState, useEffect } from "react";
import { api } from "../api/client";
import styles from "./Movies.module.css";

export default function Movies() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .getMovies()
      .then((data) => {
        if (!cancelled) setMovies(data.movies || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.data?.error || err.message || "Failed to load movies");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className={styles.loading}>Loading movies…</div>;
  if (error) return <div className="form-error">{error}</div>;

  return (
    <div className={styles.movies}>
      <h1 className={styles.title}>Movies</h1>
      <p className={styles.subtitle}>Admin & moderator only</p>
      <ul className={styles.list}>
        {movies.map((movie, i) => (
          <li key={i}>{movie}</li>
        ))}
      </ul>
    </div>
  );
}
