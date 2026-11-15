/**
 * テスト用の最小限のインメモリ Firestore。
 * ルートハンドラのテストで firebase-admin/firestore の getFirestore を差し替えるために使う。
 * 実物と同じく「トランザクション内で書き込み後に読むと例外」「失敗したトランザクションの
 * 書き込みは反映されない」「merge は入れ子のマップも統合」「create は既存なら ALREADY_EXISTS」
 * を再現する（ここが緩いと実行時にだけ落ちる順序ミスを見逃すため）。
 */

export const SERVER_TIMESTAMP = "SERVER_TIMESTAMP";

/** FieldValue.increment の代わりに使う番兵 */
export interface IncrementSentinel {
  __increment: number;
}

export function incrementSentinel(n: number): IncrementSentinel {
  return { __increment: n };
}

function isIncrement(value: unknown): value is IncrementSentinel {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as IncrementSentinel).__increment === "number"
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function containsUndefined(value: unknown): boolean {
  if (value === undefined) return true;
  if (Array.isArray(value)) return value.some(containsUndefined);
  if (isPlainObject(value)) return Object.values(value).some(containsUndefined);
  return false;
}

function applyIncrements(
  current: Record<string, unknown> | undefined,
  data: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (isIncrement(value)) {
      const base = Number(current?.[key] ?? 0);
      result[key] = base + value.__increment;
    } else {
      result[key] = value;
    }
  }
  return result;
}

function deepMerge(
  base: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = deepMerge(result[key] as Record<string, unknown>, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export class FakeFirestoreError extends Error {
  constructor(
    message: string,
    public readonly code: number
  ) {
    super(message);
  }
}

export interface FakeSnapshot {
  id: string;
  exists: boolean;
  ref: FakeDocRef;
  data: () => Record<string, unknown> | undefined;
}

export class FakeDocRef {
  constructor(
    private readonly db: FakeFirestore,
    public readonly path: string
  ) {}

  get id(): string {
    return this.path.split("/").pop()!;
  }

  collection(name: string): FakeCollectionRef {
    return new FakeCollectionRef(this.db, `${this.path}/${name}`);
  }

  async get(): Promise<FakeSnapshot> {
    this.db.failIfConfigured("get", this.path);
    return this.db.snapshot(this.path);
  }

  async set(
    data: Record<string, unknown>,
    options?: { merge?: boolean }
  ): Promise<void> {
    this.db.failIfConfigured("set", this.path);
    this.db.write(this.path, data, options);
  }

  async create(data: Record<string, unknown>): Promise<void> {
    this.db.failIfConfigured("create", this.path);
    if (this.db.docs.has(this.path)) {
      throw new FakeFirestoreError("ALREADY_EXISTS", 6);
    }
    this.db.write(this.path, data);
  }

  async delete(): Promise<void> {
    this.db.failIfConfigured("delete", this.path);
    this.db.docs.delete(this.path);
    this.db.deletedPaths.push(this.path);
  }
}

class FakeQuery {
  constructor(
    protected readonly db: FakeFirestore,
    public readonly path: string,
    private readonly filters: Array<[string, unknown]> = []
  ) {}

  where(field: string, op: string, value: unknown): FakeQuery {
    if (op !== "==") throw new Error(`unsupported op: ${op}`);
    return new FakeQuery(this.db, this.path, [...this.filters, [field, value]]);
  }

  async get() {
    const prefix = `${this.path}/`;
    const docs = [...this.db.docs.entries()]
      .filter(
        ([path, data]) =>
          path.startsWith(prefix) &&
          !path.slice(prefix.length).includes("/") &&
          this.filters.every(([field, value]) => data[field] === value)
      )
      .map(([path]) => this.db.snapshot(path));
    return { docs, size: docs.length, empty: docs.length === 0 };
  }
}

export class FakeCollectionRef extends FakeQuery {
  doc(id: string): FakeDocRef {
    return new FakeDocRef(this.db, `${this.path}/${id}`);
  }
}

export class FakeTransaction {
  private writes: Array<() => void> = [];
  private written = false;

  constructor(private readonly db: FakeFirestore) {}

  async get(ref: FakeDocRef): Promise<FakeSnapshot> {
    if (this.written) throw new Error("READ_AFTER_WRITE");
    return ref.get();
  }

  set(
    ref: FakeDocRef,
    data: Record<string, unknown>,
    options?: { merge?: boolean }
  ): void {
    this.written = true;
    this.writes.push(() => this.db.write(ref.path, data, options));
  }

  delete(ref: FakeDocRef): void {
    this.written = true;
    this.writes.push(() => {
      this.db.docs.delete(ref.path);
      this.db.deletedPaths.push(ref.path);
    });
  }

  commit(): void {
    for (const write of this.writes) write();
  }
}

export class FakeFirestore {
  readonly docs = new Map<string, Record<string, unknown>>();
  readonly deletedPaths: string[] = [];
  /** 指定パス（前方一致）の操作を失敗させる */
  private failures: Array<{ op: string; prefix: string; error: Error }> = [];

  seed(path: string, data: Record<string, unknown>): void {
    this.docs.set(path, { ...data });
  }

  failOn(op: "get" | "set" | "create" | "delete", prefix: string, error: Error) {
    this.failures.push({ op, prefix, error });
  }

  failIfConfigured(op: string, path: string): void {
    const failure = this.failures.find(
      f => f.op === op && path.startsWith(f.prefix)
    );
    if (failure) throw failure.error;
  }

  snapshot(path: string): FakeSnapshot {
    const data = this.docs.get(path);
    return {
      id: path.split("/").pop()!,
      exists: data !== undefined,
      ref: new FakeDocRef(this, path),
      data: () => (data ? { ...data } : undefined),
    };
  }

  write(
    path: string,
    data: Record<string, unknown>,
    options?: { merge?: boolean }
  ): void {
    if (containsUndefined(data)) {
      // 実物の Firestore は undefined を含む書き込みを例外にする
      throw new Error(`Cannot use "undefined" as a Firestore value (${path})`);
    }
    const current = this.docs.get(path);
    const resolved = applyIncrements(current, data);
    this.docs.set(
      path,
      options?.merge && current ? deepMerge(current, resolved) : resolved
    );
  }

  collection(name: string): FakeCollectionRef {
    return new FakeCollectionRef(this, name);
  }

  doc(path: string): FakeDocRef {
    return new FakeDocRef(this, path);
  }

  async runTransaction<T>(fn: (tx: FakeTransaction) => Promise<T>): Promise<T> {
    const tx = new FakeTransaction(this);
    const result = await fn(tx);
    tx.commit();
    return result;
  }

  async recursiveDelete(ref: FakeDocRef): Promise<void> {
    for (const path of [...this.docs.keys()]) {
      if (path === ref.path || path.startsWith(`${ref.path}/`)) {
        this.docs.delete(path);
        this.deletedPaths.push(path);
      }
    }
  }
}
