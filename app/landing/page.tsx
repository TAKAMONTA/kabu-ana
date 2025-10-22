"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "../lib/firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../lib/firebase";
import styles from "./landing.module.css";

export default function LandingPage() {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <nav className={styles.nav}>
          <div className={styles.logo}>
            <span className={styles.logoText}>株価分析</span>
            <span className={styles.logoSub}>kabu-ana</span>
          </div>
          <div className={styles.navLinks}>
            <Link href="/karte" className={styles.navLink}>
              AIカードを試す
            </Link>
            <Link href="#features" className={styles.navLink}>
              機能
            </Link>
            <Link href="#how-it-works" className={styles.navLink}>
              使い方
            </Link>
            <Link href="/login" className={styles.loginButton}>
              ログイン
            </Link>
            <Link href="/login" className={styles.signupButton}>
              新規登録
            </Link>
          </div>
        </nav>
      </header>

      <main className={styles.main}>
        <section
          className={`${styles.hero} ${isVisible ? styles.visible : ""}`}
        >
          <h1 className={styles.title}>
            <span className={styles.titleMain}>AI株価分析ツール</span>
            <span className={styles.titleSub}>
              データドリブン投資のための包括的株価分析プラットフォーム
            </span>
          </h1>

          <p className={styles.description}>
            最新のAI技術を活用して、日本株・米国株の包括的な投資判断の分析を提供します。
            <br />
            投資判断に必要な情報を、わかりやすく整理してお届けします。
          </p>

          <div className={styles.cta}>
            <Link href="/karte" className={styles.primaryButton}>
              今すぐ分析を始める
            </Link>
            <Link href="#features" className={styles.secondaryButton}>
              機能を見る
            </Link>
          </div>

          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statNumber}>5,000+</span>
              <span className={styles.statLabel}>分析完了</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNumber}>リアルタイム</span>
              <span className={styles.statLabel}>データ更新</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNumber}>5つのAI分析</span>
              <span className={styles.statLabel}>AI分析</span>
            </div>
          </div>
        </section>

        <section id="features" className={styles.features}>
          <h2 className={styles.sectionTitle}>主要機能</h2>

          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🤖</div>
              <h3 className={styles.featureTitle}>AI総合分析</h3>
              <p className={styles.featureDescription}>
                複数のAIエンジンを組み合わせた包括的な分析が投資判断の財務指標や市場動向を総合的に評価します。
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>📈</div>
              <h3 className={styles.featureTitle}>SWOT分析</h3>
              <p className={styles.featureDescription}>
                会社の強み・弱み・機会・脅威を体系的に整理し、投資判断のための包括的な視点を提供します。
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>💡</div>
              <h3 className={styles.featureTitle}>ニュース分析</h3>
              <p className={styles.featureDescription}>
                ニュースや財務諸表から、企業の将来性や市場動向を分析し、投資判断の参考にします。
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>📊</div>
              <h3 className={styles.featureTitle}>チャート分析</h3>
              <p className={styles.featureDescription}>
                株価チャートやテクニカル指標を分析し、トレンドやサインを見つけ、投資判断の参考にします。
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🔍</div>
              <h3 className={styles.featureTitle}>キーワード分析</h3>
              <p className={styles.featureDescription}>
                企業のニュースや財務諸表から、重要なキーワードを抽出し、投資判断の参考にします。
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>👥</div>
              <h3 className={styles.featureTitle}>コミュニティ分析</h3>
              <p className={styles.featureDescription}>
                ソーシャルメディアやブログから、企業の評判や市場動向を分析し、投資判断の参考にします。
              </p>
            </div>
          </div>
        </section>

        <section id="how-it-works" className={styles.howItWorks}>
          <h2 className={styles.sectionTitle}>使い方</h2>

          <div className={styles.steps}>
            <div className={styles.step}>
              <div className={styles.stepNumber}>1</div>
              <h3 className={styles.stepTitle}>株式コードを入力</h3>
              <p className={styles.stepDescription}>
                株式コードを入力して、分析したい企業のデータを取得します。
              </p>
            </div>

            <div className={styles.step}>
              <div className={styles.stepNumber}>2</div>
              <h3 className={styles.stepTitle}>AI分析を実行</h3>
              <p className={styles.stepDescription}>
                入力した株式コードに基づいて、5つのAI分析を実行します。
              </p>
            </div>

            <div className={styles.step}>
              <div className={styles.stepNumber}>3</div>
              <h3 className={styles.stepTitle}>結果を確認</h3>
              <p className={styles.stepDescription}>
                分析結果を確認し、投資判断の参考にします。
              </p>
            </div>
          </div>
        </section>

        <section className={styles.demo}>
          <h2 className={styles.sectionTitle}>AI分析結果</h2>
          <div className={styles.demoContent}>
            <div className={styles.demoCard}>
              <h3>ソニー(7203)</h3>
              <div className={styles.demoStats}>
                <div className={styles.demoStat}>
                  <span className={styles.demoLabel}>総合評価</span>
                  <span className={styles.demoValue}>★★★★★</span>
                </div>
                <div className={styles.demoStat}>
                  <span className={styles.demoLabel}>財務指標</span>
                  <span className={styles.demoValueBuy}>BUY</span>
                </div>
                <div className={styles.demoStat}>
                  <span className={styles.demoLabel}>将来性</span>
                  <span className={styles.demoValue}>+15.2%</span>
                </div>
              </div>
              <p className={styles.demoDescription}>
                ソニーの株価は、財務指標の改善と将来性の高さから、投資価値が高いと判断できます。
              </p>
            </div>
          </div>
        </section>

        <section className={styles.cta2}>
          <div className={styles.ctaContent}>
            <h2 className={styles.ctaTitle}>AI投資を始めよう</h2>
            <p className={styles.ctaDescription}>
              データドリブンな投資判断のために、AI分析ツールを活用してみませんか？
            </p>
            <Link href="/karte" className={styles.ctaButton}>
              今すぐAI投資を始める
            </Link>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerSection}>
            <h4 className={styles.footerTitle}>株価分析 (kabu-ana)</h4>
            <p className={styles.footerText}>
              AI技術を活用した包括的な株価分析のためのツール
            </p>
          </div>

          <div className={styles.footerSection}>
            <h4 className={styles.footerTitle}>機能</h4>
            <ul className={styles.footerLinks}>
              <li>
                <Link href="/karte">AIカードを試す</Link>
              </li>
              <li>
                <Link href="#features">主要機能</Link>
              </li>
              <li>
                <Link href="#how-it-works">使い方</Link>
              </li>
            </ul>
          </div>

          <div className={styles.footerSection}>
            <h4 className={styles.footerTitle}>サービス</h4>
            <ul className={styles.footerLinks}>
              <li>
                <Link href="/terms">利用規約</Link>
              </li>
              <li>
                <Link href="/privacy">プライバシーポリシー</Link>
              </li>
              <li>
                <Link href="/contact">お問い合わせ</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className={styles.footerBottom}>
          <p>&copy; 2024 株価分析 (kabu-ana). All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
