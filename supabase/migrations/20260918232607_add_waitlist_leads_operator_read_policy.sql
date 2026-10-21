-- A tabela waitlist_leads já existia (criada para a landing page, insert
-- liberado para anon), mas nenhuma policy permitia leitura para
-- operadores autenticados — por isso a ferramenta interna não enxergava
-- nada nela mesmo com dados.
create policy "Operators can view waitlist leads" on public.waitlist_leads
  for select to authenticated using (true);
