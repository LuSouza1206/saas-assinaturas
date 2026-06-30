const API = process.env.API_URL ?? "http://127.0.0.1:4000";

async function req<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  }
  return data as T;
}

async function main() {
  const health = await req<{ status: string; db: string }>("/health");
  if (health.db !== "up") throw new Error(`DB not up: ${JSON.stringify(health)}`);

  const ts = Date.now().toString(36);
  const a = await req<{ token: string; tenant: { subdomain: string } }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      companyName: "Tenant A Test",
      subdomain: `ta-${ts}`,
      email: `a-${ts}@test.local`,
      password: "senha12345",
      name: "Admin A",
    }),
  });

  const b = await req<{ token: string; tenant: { subdomain: string } }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      companyName: "Tenant B Test",
      subdomain: `tb-${ts}`,
      email: `b-${ts}@test.local`,
      password: "senha12345",
      name: "Admin B",
    }),
  });

  const planA = await req<{ id: string; name: string }>("/plans", {
    method: "POST",
    token: a.token,
    body: JSON.stringify({
      name: `Secret Plan ${ts}`,
      price: 9900,
      interval: "month",
    }),
  });

  const plansB = await req<Array<{ id: string }>>("/plans", { token: b.token });
  const plansA = await req<Array<{ id: string }>>("/plans", { token: a.token });
  const leaked = plansB.some((p) => p.id === planA.id);

  if (leaked) {
    console.error("FAIL: tenant B can see tenant A plan", planA.id);
    process.exit(1);
  }
  if (plansA.length < 1) {
    console.error("FAIL: tenant A has no plans after create");
    process.exit(1);
  }

  console.log("PASS: multi-tenant isolation OK");
  console.log(`  A=${a.tenant.subdomain} plans=${plansA.length}`);
  console.log(`  B=${b.tenant.subdomain} plans=${plansB.length}`);
}

main().catch((err) => {
  console.error("FAIL:", err.message ?? err);
  process.exit(1);
});
