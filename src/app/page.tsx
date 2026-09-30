import { Casino } from "@/components/Casino";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className="container">
      <section className={styles.hero}>
        <h1 className={styles.title}>
          Devine le dé, <span className="gold-text">gagne ×5</span>
        </h1>
        <p className={styles.subtitle}>
          Choisis un chiffre, mise entre 1 et 10 GNOT et lance le dé sur la blockchain Gno.land. Un lancer toutes les 10 minutes.
        </p>
      </section>
      <Casino />
    </main>
  );
}
