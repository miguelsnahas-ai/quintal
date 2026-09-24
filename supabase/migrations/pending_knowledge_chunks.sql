-- Base de conhecimento para dar contexto (RAG) às respostas do Quintal.
-- Fonte: planilha de cuidados/desenvolvimento infantil compartilhada pelo
-- time (materiais, brincadeiras, alimentos, receitas, métodos de
-- alimentação, rotinas de sono, formas de dormir, desenvolvimento,
-- higiene, passeios). Cada linha da planilha virou um chunk autocontido,
-- conforme a própria planilha recomendava ("Sugestão para o RAG": indexar
-- cada linha como documento, usar idade mín./máx. como filtro e
-- tags/categoria como busca). Conteúdo de referência geral — não substitui
-- avaliação profissional individual (pediatra, nutricionista etc.).

-- to_tsvector(regconfig, text) is only STABLE, not IMMUTABLE, so Postgres
-- rejects it directly inside a "generated always as ... stored" expression
-- (42P17). Wrapping it in a SQL function hard-coded to 'portuguese' and
-- declared immutable is the standard workaround — safe here because we
-- never change the text search config at runtime.
create function public.knowledge_chunks_tsvector(text) returns tsvector as $$
  select to_tsvector('portuguese', $1)
$$ language sql immutable;

create table public.knowledge_chunks (
  id text primary key,
  category text not null,
  title text not null,
  age_min_months integer,
  age_max_months integer,
  tags text[],
  content text not null,
  search tsvector generated always as (
    public.knowledge_chunks_tsvector(title || ' ' || content || ' ' || coalesce(array_to_string(tags, ' '), ''))
  ) stored,
  created_at timestamptz not null default now()
);

create index knowledge_chunks_search_idx on public.knowledge_chunks using gin (search);
create index knowledge_chunks_category_idx on public.knowledge_chunks (category);
create index knowledge_chunks_age_idx on public.knowledge_chunks (age_min_months, age_max_months);

alter table public.knowledge_chunks enable row level security;

-- Reference/read-only data: no write policy — rows are seeded by migration
-- and read via the service-role client from suggestReply's RAG lookup, the
-- same pattern already used for ai_settings.
create policy "Operators can view knowledge_chunks" on public.knowledge_chunks
  for select to authenticated using (true);

insert into public.knowledge_chunks (id, category, title, age_min_months, age_max_months, tags, content) values
('MAT-001', 'materiais', 'Rolos de papel higiênico', 6, 72, ARRAY['reciclável', 'baixo custo', 'encaixe']::text[], 'Material: Rolos de papel higiênico
Categoria: Reciclável
Como conseguir / custo: Lixo reciclável da casa; custo zero
Idade mín. (meses): 6
Idade máx. (meses): 72
Faixa etária: 6m+
Estilos de brincadeira: Sensorial; construção; faz-de-conta; arte
Ideias de atividades por idade: 6–12m: rolar e bater rolos; 12m+: encaixar bolinhas de papel e deixar cair; 2a+: binóculo, torre, pista de carrinho colada na parede, carimbo com tinta
Áreas de desenvolvimento: Motor fino; causa e efeito; criatividade
Supervisão: Média
Segurança: Retirar restos de cola/papel solto; descartar se molhado ou mastigado
Tags: reciclável; baixo custo; encaixe'),
('MAT-002', 'materiais', 'Tubos de papelão maiores (papel-toalha, alumínio)', 9, 72, ARRAY['rampa', 'som', 'reciclável']::text[], 'Material: Tubos de papelão maiores (papel-toalha, alumínio)
Categoria: Reciclável
Como conseguir / custo: Reciclável; lojas de tecido costumam doar tubos grandes
Idade mín. (meses): 9
Idade máx. (meses): 72
Faixa etária: 9m+
Estilos de brincadeira: Exploração; causa e efeito; motor grosso
Ideias de atividades por idade: Rampa para bolinhas e carrinhos; ''telefone'' para falar e ouvir a voz diferente; bastão para marcha
Áreas de desenvolvimento: Linguagem; causa e efeito; noção de espaço
Supervisão: Média
Segurança: Tubos de alumínio/filme: remover bordas metálicas
Tags: rampa; som; reciclável'),
('MAT-003', 'materiais', 'Fita crepe', 12, 72, ARRAY['fita', 'percurso', 'chão']::text[], 'Material: Fita crepe
Categoria: Casa/papelaria
Como conseguir / custo: Papelaria; baixo custo
Idade mín. (meses): 12
Idade máx. (meses): 72
Faixa etária: 1a+
Estilos de brincadeira: Motor fino; motor grosso; faz-de-conta
Ideias de atividades por idade: Caminho no chão para seguir/pular; colar objetos leves na parede e puxar; ''teia'' no batente da porta para jogar bolinhas de papel; estrada para carrinhos
Áreas de desenvolvimento: Motor fino (pinça ao descolar); equilíbrio; planejamento
Supervisão: Média
Segurança: Fita pode ser mastigada: supervisionar menores de 2a; retirar ao final
Tags: fita; percurso; chão'),
('MAT-004', 'materiais', 'Plástico bolha', 6, 48, ARRAY['sensorial', 'textura', 'som']::text[], 'Material: Plástico bolha
Categoria: Reciclável
Como conseguir / custo: Embalagens de entregas
Idade mín. (meses): 6
Idade máx. (meses): 48
Faixa etária: 6m–4a
Estilos de brincadeira: Sensorial; motor grosso; arte
Ideias de atividades por idade: Tapete para engatinhar/pisar descalço; pintar e carimbar no papel; ''estourar'' com dedos (2a+)
Áreas de desenvolvimento: Sensorial tátil e auditivo; força das mãos
Supervisão: Alta
Segurança: Nunca deixar sozinho: risco de sufocamento; bolhas estouradas não devem ir à boca
Tags: sensorial; textura; som'),
('MAT-005', 'materiais', 'Caixas de papelão grandes', 6, 72, ARRAY['caixa', 'cabana', 'casinha']::text[], 'Material: Caixas de papelão grandes
Categoria: Reciclável
Como conseguir / custo: Supermercados, lojas de eletrodomésticos
Idade mín. (meses): 6
Idade máx. (meses): 72
Faixa etária: 6m+
Estilos de brincadeira: Faz-de-conta; motor grosso; construção
Ideias de atividades por idade: 6–12m: túnel para engatinhar; 12m+: carro, casinha, barco; 2a+: pintar e decorar
Áreas de desenvolvimento: Motor grosso; imaginação; noção espacial
Supervisão: Baixa
Segurança: Retirar grampos e fitas soltas
Tags: caixa; cabana; casinha'),
('MAT-006', 'materiais', 'Caixas pequenas e potes com tampa', 8, 48, ARRAY['permanência do objeto', 'encaixe', 'montessori']::text[], 'Material: Caixas pequenas e potes com tampa
Categoria: Reciclável
Como conseguir / custo: Reciclável (caixas de sapato, potes de sorvete)
Idade mín. (meses): 8
Idade máx. (meses): 48
Faixa etária: 8m–4a
Estilos de brincadeira: Permanência do objeto; encaixe
Ideias de atividades por idade: Esconder brinquedo e ''achar''; caixa com furo para encaixar bolinhas ou palitos grandes; abrir e fechar tampas
Áreas de desenvolvimento: Cognitivo; motor fino
Supervisão: Média
Segurança: Objetos colocados dentro devem ter mais de 4 cm
Tags: permanência do objeto; encaixe; montessori'),
('MAT-007', 'materiais', 'Tintas naturais (beterraba, açafrão/cúrcuma, espinafre, urucum, cacau)', 8, 72, ARRAY['tinta comestível', 'arte', 'sensorial']::text[], 'Material: Tintas naturais (beterraba, açafrão/cúrcuma, espinafre, urucum, cacau)
Categoria: Arte natural
Como conseguir / custo: Cozinha: cozinhar/bater o alimento e misturar com um pouco de amido de milho ou farinha
Idade mín. (meses): 8
Idade máx. (meses): 72
Faixa etária: 8m+
Estilos de brincadeira: Arte; sensorial
Ideias de atividades por idade: Pintura com as mãos em papel grande no chão; pintura com frutas cortadas como carimbo; pintura no banho
Áreas de desenvolvimento: Sensorial; criatividade; coordenação olho-mão
Supervisão: Média
Segurança: Seguro se levado à boca, mas usar só alimentos já introduzidos; cúrcuma e beterraba mancham
Tags: tinta comestível; arte; sensorial'),
('MAT-008', 'materiais', 'Tinta caseira de farinha e água (tinta-cola)', 10, 72, ARRAY['tinta caseira', 'arte']::text[], 'Material: Tinta caseira de farinha e água (tinta-cola)
Categoria: Arte natural
Como conseguir / custo: 1 parte de farinha de trigo + 1 de água + corante alimentício ou de alimento
Idade mín. (meses): 10
Idade máx. (meses): 72
Faixa etária: 10m+
Estilos de brincadeira: Arte; sensorial
Ideias de atividades por idade: Pintura a dedo; misturar cores; pintar caixas
Áreas de desenvolvimento: Sensorial; causa e efeito das cores
Supervisão: Média
Segurança: Contém trigo: atenção a alergia; guardar na geladeira até 2 dias
Tags: tinta caseira; arte'),
('MAT-009', 'materiais', 'Massinha caseira', 18, 72, ARRAY['massinha', 'modelar']::text[], 'Material: Massinha caseira
Categoria: Arte natural
Como conseguir / custo: Farinha, sal, água, óleo e corante alimentício
Idade mín. (meses): 18
Idade máx. (meses): 72
Faixa etária: 1a6m+
Estilos de brincadeira: Sensorial; modelagem; faz-de-conta
Ideias de atividades por idade: Apertar, rolar cobrinhas, cortar com espátula, fazer ''comidinha'', carimbar com tampinhas
Áreas de desenvolvimento: Força das mãos; motor fino; imaginação
Supervisão: Média
Segurança: Alto teor de sal: não deixar comer; para menores de 18m preferir massinha comestível sem sal
Tags: massinha; modelar'),
('MAT-010', 'materiais', 'Areia de modelar / areia de cozinha (farinha + óleo)', 12, 72, ARRAY['areia', 'sensorial']::text[], 'Material: Areia de modelar / areia de cozinha (farinha + óleo)
Categoria: Sensorial
Como conseguir / custo: 8 partes de farinha + 1 de óleo
Idade mín. (meses): 12
Idade máx. (meses): 72
Faixa etária: 1a+
Estilos de brincadeira: Sensorial; faz-de-conta
Ideias de atividades por idade: Encher e esvaziar potinhos, esconder objetos, ''bolo'' com forminhas
Áreas de desenvolvimento: Sensorial; noção de quantidade
Supervisão: Média
Segurança: Usar sobre lençol velho; trigo: atenção a alergia
Tags: areia; sensorial'),
('MAT-011', 'materiais', 'Água', 6, 72, ARRAY['água', 'sensorial', 'transferência']::text[], 'Material: Água
Categoria: Natureza/casa
Como conseguir / custo: Torneira, bacia, banho
Idade mín. (meses): 6
Idade máx. (meses): 72
Faixa etária: 6m+
Estilos de brincadeira: Sensorial; ciência; motor fino
Ideias de atividades por idade: Bacia com água e copos para transferir; esponjas para espremer; pincel com água na parede externa/calçada; objetos que boiam e afundam
Áreas de desenvolvimento: Sensorial; causa e efeito; motor fino
Supervisão: Alta
Segurança: Nunca deixar criança sozinha perto de água, mesmo pouca profundidade; esvaziar a bacia ao final
Tags: água; sensorial; transferência'),
('MAT-012', 'materiais', 'Gelo (com flores, frutas ou brinquedos congelados)', 9, 72, ARRAY['gelo', 'calor', 'sensorial']::text[], 'Material: Gelo (com flores, frutas ou brinquedos congelados)
Categoria: Sensorial
Como conseguir / custo: Forminhas de gelo
Idade mín. (meses): 9
Idade máx. (meses): 72
Faixa etária: 9m+
Estilos de brincadeira: Sensorial; ciência
Ideias de atividades por idade: Resgatar brinquedo congelado com água morna e colheres; gelo colorido sobre papel
Áreas de desenvolvimento: Sensorial térmico; paciência; ciência
Supervisão: Alta
Segurança: Cubos pequenos são risco de engasgo: usar blocos grandes
Tags: gelo; calor; sensorial'),
('MAT-013', 'materiais', 'Farinhas, arroz e grãos secos (bandeja sensorial)', 18, 72, ARRAY['bandeja sensorial', 'transferência']::text[], 'Material: Farinhas, arroz e grãos secos (bandeja sensorial)
Categoria: Sensorial
Como conseguir / custo: Cozinha
Idade mín. (meses): 18
Idade máx. (meses): 72
Faixa etária: 1a6m+
Estilos de brincadeira: Sensorial; transferência
Ideias de atividades por idade: Transferir com colher e funil; esconder e achar objetos; desenhar com o dedo na farinha
Áreas de desenvolvimento: Motor fino; concentração
Supervisão: Alta
Segurança: Grãos crus são risco de engasgo e de ir ao nariz/ouvido; para menores usar farinha ou aveia
Tags: bandeja sensorial; transferência'),
('MAT-014', 'materiais', 'Colheres de pau, panelas e tampas', 6, 48, ARRAY['música', 'cozinha', 'faz-de-conta']::text[], 'Material: Colheres de pau, panelas e tampas
Categoria: Cozinha
Como conseguir / custo: Cozinha
Idade mín. (meses): 6
Idade máx. (meses): 48
Faixa etária: 6m–4a
Estilos de brincadeira: Musical; causa e efeito
Ideias de atividades por idade: Tambor de panela; bater tampas; mexer ''sopa'' de faz-de-conta
Áreas de desenvolvimento: Ritmo; causa e efeito; audição
Supervisão: Baixa
Segurança: Evitar objetos pesados ou com bordas cortantes
Tags: música; cozinha; faz-de-conta'),
('MAT-015', 'materiais', 'Potes plásticos e copos de medida', 6, 48, ARRAY['empilhar', 'encaixe']::text[], 'Material: Potes plásticos e copos de medida
Categoria: Cozinha
Como conseguir / custo: Cozinha
Idade mín. (meses): 6
Idade máx. (meses): 48
Faixa etária: 6m–4a
Estilos de brincadeira: Encaixe; empilhar; água
Ideias de atividades por idade: Empilhar e derrubar; encaixar tamanhos; transferir água ou areia
Áreas de desenvolvimento: Motor fino; noção de tamanho
Supervisão: Baixa
Segurança: Verificar rachaduras
Tags: empilhar; encaixe'),
('MAT-016', 'materiais', 'Garrafas PET (garrafa sensorial)', 6, 48, ARRAY['garrafa sensorial', 'chocalho', 'boliche']::text[], 'Material: Garrafas PET (garrafa sensorial)
Categoria: Reciclável
Como conseguir / custo: Reciclável; lacrar tampa com cola quente
Idade mín. (meses): 6
Idade máx. (meses): 48
Faixa etária: 6m–4a
Estilos de brincadeira: Sensorial; visual; musical
Ideias de atividades por idade: Garrafa com água, glitter e óleo para observar; chocalho com arroz; boliche com garrafas vazias (2a+)
Áreas de desenvolvimento: Rastreamento visual; causa e efeito; motor grosso
Supervisão: Média
Segurança: Sempre colar a tampa; descartar se rachar
Tags: garrafa sensorial; chocalho; boliche'),
('MAT-017', 'materiais', 'Tampinhas de garrafa', 36, 72, ARRAY['classificar', 'cores', 'contar']::text[], 'Material: Tampinhas de garrafa
Categoria: Reciclável
Como conseguir / custo: Reciclável
Idade mín. (meses): 36
Idade máx. (meses): 72
Faixa etária: 3a+
Estilos de brincadeira: Matemática; arte; classificação
Ideias de atividades por idade: Separar por cor, contar, fazer mosaico, jogo da memória com adesivos
Áreas de desenvolvimento: Cognitivo; motor fino
Supervisão: Média
Segurança: Risco de engasgo para menores de 3a
Tags: classificar; cores; contar'),
('MAT-018', 'materiais', 'Pregadores de roupa', 24, 72, ARRAY['pregador', 'pinça']::text[], 'Material: Pregadores de roupa
Categoria: Casa
Como conseguir / custo: Varal
Idade mín. (meses): 24
Idade máx. (meses): 72
Faixa etária: 2a+
Estilos de brincadeira: Motor fino
Ideias de atividades por idade: Prender na borda de caixa ou pote; prender figuras de papel; ''pentear'' o cabelo de bonecos
Áreas de desenvolvimento: Força de pinça; preparação para escrita
Supervisão: Média
Segurança: Pode beliscar os dedos: mostrar como usar
Tags: pregador; pinça'),
('MAT-019', 'materiais', 'Lenços, panos e retalhos de tecido', 6, 72, ARRAY['tecido', 'esconde', 'cabana']::text[], 'Material: Lenços, panos e retalhos de tecido
Categoria: Casa
Como conseguir / custo: Gaveta de panos, retalhos
Idade mín. (meses): 6
Idade máx. (meses): 72
Faixa etária: 6m+
Estilos de brincadeira: Sensorial; esconde-esconde; faz-de-conta
Ideias de atividades por idade: ''Cadê? Achou!''; puxar lenços de dentro de caixa de lenço vazia; capa de super-herói; cabana
Áreas de desenvolvimento: Permanência do objeto; motor fino; imaginação
Supervisão: Média
Segurança: Não deixar tecidos no berço durante o sono
Tags: tecido; esconde; cabana'),
('MAT-020', 'materiais', 'Lençóis e cadeiras (cabana)', 12, 72, ARRAY['cabana', 'faz-de-conta']::text[], 'Material: Lençóis e cadeiras (cabana)
Categoria: Casa
Como conseguir / custo: Casa
Idade mín. (meses): 12
Idade máx. (meses): 72
Faixa etária: 1a+
Estilos de brincadeira: Faz-de-conta; aconchego
Ideias de atividades por idade: Montar cabana para ler, lanchar, brincar de acampar com lanterna
Áreas de desenvolvimento: Imaginação; regulação emocional
Supervisão: Baixa
Segurança: Fixar bem para não cair sobre a criança
Tags: cabana; faz-de-conta'),
('MAT-021', 'materiais', 'Almofadas e colchonetes', 8, 72, ARRAY['percurso', 'escalar']::text[], 'Material: Almofadas e colchonetes
Categoria: Casa
Como conseguir / custo: Casa
Idade mín. (meses): 8
Idade máx. (meses): 72
Faixa etária: 8m+
Estilos de brincadeira: Motor grosso
Ideias de atividades por idade: Montanha para escalar; percurso; ''pular no rio''
Áreas de desenvolvimento: Equilíbrio; força; consciência corporal
Supervisão: Média
Segurança: Não usar para dormir com bebês; espaço livre de quinas
Tags: percurso; escalar'),
('MAT-022', 'materiais', 'Espelho (inquebrável)', 0, 36, ARRAY['espelho', 'montessori', 'tummy time']::text[], 'Material: Espelho (inquebrável)
Categoria: Casa
Como conseguir / custo: Espelho de acrílico ou fixado com segurança
Idade mín. (meses): 0
Idade máx. (meses): 36
Faixa etária: 0m–3a
Estilos de brincadeira: Autoconhecimento; social
Ideias de atividades por idade: Bebê de bruços diante do espelho; fazer caretas juntos; nomear partes do rosto
Áreas de desenvolvimento: Social-emocional; linguagem; motor (tummy time)
Supervisão: Baixa
Segurança: Usar acrílico ou espelho fixo e protegido
Tags: espelho; montessori; tummy time'),
('MAT-023', 'materiais', 'Elementos da natureza (folhas, pinhas, gravetos, pedras grandes, conchas)', 9, 72, ARRAY['natureza', 'cesto dos tesouros', 'waldorf']::text[], 'Material: Elementos da natureza (folhas, pinhas, gravetos, pedras grandes, conchas)
Categoria: Natureza
Como conseguir / custo: Passeios em parques e praia
Idade mín. (meses): 9
Idade máx. (meses): 72
Faixa etária: 9m+
Estilos de brincadeira: Exploração; cesto dos tesouros; arte
Ideias de atividades por idade: Cesto com texturas; separar por tamanho; pintar pedras; colagem de folhas
Áreas de desenvolvimento: Sensorial; classificação; linguagem
Supervisão: Alta
Segurança: Nada menor que 4 cm para menores de 3a; lavar; evitar plantas desconhecidas
Tags: natureza; cesto dos tesouros; waldorf'),
('MAT-024', 'materiais', 'Cesto dos tesouros (objetos do cotidiano)', 6, 18, ARRAY['cesto dos tesouros', 'heurístico', 'montessori']::text[], 'Material: Cesto dos tesouros (objetos do cotidiano)
Categoria: Heurístico
Como conseguir / custo: Objetos da casa em cesto de vime baixo
Idade mín. (meses): 6
Idade máx. (meses): 18
Faixa etária: 6m–1a6m
Estilos de brincadeira: Sensorial; exploração autônoma
Ideias de atividades por idade: Cesto com 15–30 objetos de materiais naturais variados (madeira, metal, tecido, escova) para o bebê sentado explorar
Áreas de desenvolvimento: Sensorial; concentração; motor fino
Supervisão: Média
Segurança: Checar tamanhos e bordas; retirar o que solta partes
Tags: cesto dos tesouros; heurístico; montessori'),
('MAT-025', 'materiais', 'Colheres, conchas e utensílios de metal', 6, 36, ARRAY['metal', 'som']::text[], 'Material: Colheres, conchas e utensílios de metal
Categoria: Cozinha
Como conseguir / custo: Cozinha
Idade mín. (meses): 6
Idade máx. (meses): 36
Faixa etária: 6m–3a
Estilos de brincadeira: Sensorial; musical
Ideias de atividades por idade: Bater, comparar sons, sentir o frio do metal
Áreas de desenvolvimento: Sensorial; audição
Supervisão: Baixa
Segurança: Evitar objetos pontiagudos
Tags: metal; som'),
('MAT-026', 'materiais', 'Bolas de meia / pompons grandes', 6, 72, ARRAY['bola', 'arremesso']::text[], 'Material: Bolas de meia / pompons grandes
Categoria: Casa
Como conseguir / custo: Meias velhas enroladas
Idade mín. (meses): 6
Idade máx. (meses): 72
Faixa etária: 6m+
Estilos de brincadeira: Motor grosso
Ideias de atividades por idade: Jogar no cesto, rolar, ''guerra de bolas'' de meia
Áreas de desenvolvimento: Coordenação; força; diversão
Supervisão: Baixa
Segurança: Pompons pequenos são risco de engasgo
Tags: bola; arremesso'),
('MAT-027', 'materiais', 'Bolhas de sabão', 6, 72, ARRAY['bolha', 'sopro', 'fala']::text[], 'Material: Bolhas de sabão
Categoria: Casa
Como conseguir / custo: Detergente neutro + água + um pouco de açúcar ou glicerina
Idade mín. (meses): 6
Idade máx. (meses): 72
Faixa etária: 6m+
Estilos de brincadeira: Sensorial; motor grosso; linguagem
Ideias de atividades por idade: Adulto sopra e bebê acompanha com os olhos; criança tenta estourar; 2a+ aprende a soprar
Áreas de desenvolvimento: Rastreamento visual; sopro (fala); motor grosso
Supervisão: Média
Segurança: Não deixar beber a solução; cuidado com os olhos
Tags: bolha; sopro; fala'),
('MAT-028', 'materiais', 'Balões/bexigas', 12, 72, ARRAY['balão']::text[], 'Material: Balões/bexigas
Categoria: Festa
Como conseguir / custo: Papelaria
Idade mín. (meses): 12
Idade máx. (meses): 72
Faixa etária: 1a+
Estilos de brincadeira: Motor grosso
Ideias de atividades por idade: Manter o balão no ar; bater com raquete de prato de papel
Áreas de desenvolvimento: Coordenação; atenção
Supervisão: Alta
Segurança: Balão estourado é risco grave de sufocamento: recolher pedaços imediatamente
Tags: balão'),
('MAT-029', 'materiais', 'Jornal e revistas velhas', 9, 72, ARRAY['rasgar', 'colagem']::text[], 'Material: Jornal e revistas velhas
Categoria: Reciclável
Como conseguir / custo: Reciclável
Idade mín. (meses): 9
Idade máx. (meses): 72
Faixa etária: 9m+
Estilos de brincadeira: Sensorial; arte; motor fino
Ideias de atividades por idade: Rasgar, amassar bolinhas, ''chuva de papel'', colagem
Áreas de desenvolvimento: Motor fino; sensorial auditivo
Supervisão: Média
Segurança: Não deixar comer o papel
Tags: rasgar; colagem'),
('MAT-030', 'materiais', 'Papel kraft ou bobina grande', 12, 72, ARRAY['desenho', 'arte']::text[], 'Material: Papel kraft ou bobina grande
Categoria: Papelaria
Como conseguir / custo: Papelaria
Idade mín. (meses): 12
Idade máx. (meses): 72
Faixa etária: 1a+
Estilos de brincadeira: Arte
Ideias de atividades por idade: Desenho de corpo inteiro (contornar a criança); pintura no chão ou na parede
Áreas de desenvolvimento: Esquema corporal; motor amplo e fino
Supervisão: Baixa
Tags: desenho; arte'),
('MAT-031', 'materiais', 'Giz de cera grosso', 12, 72, ARRAY['rabisco', 'desenho']::text[], 'Material: Giz de cera grosso
Categoria: Papelaria
Como conseguir / custo: Papelaria (atóxico)
Idade mín. (meses): 12
Idade máx. (meses): 72
Faixa etária: 1a+
Estilos de brincadeira: Arte
Ideias de atividades por idade: Rabiscar livremente em papel grande preso na mesa
Áreas de desenvolvimento: Motor fino; preensão
Supervisão: Média
Segurança: Preferir atóxico e formatos grossos
Tags: rabisco; desenho'),
('MAT-032', 'materiais', 'Giz de lousa / giz de calçada', 18, 72, ARRAY['calçada', 'amarelinha']::text[], 'Material: Giz de lousa / giz de calçada
Categoria: Papelaria
Como conseguir / custo: Papelaria
Idade mín. (meses): 18
Idade máx. (meses): 72
Faixa etária: 1a6m+
Estilos de brincadeira: Arte; motor grosso
Ideias de atividades por idade: Desenhar na calçada; amarelinha; caminho para seguir
Áreas de desenvolvimento: Motor grosso; criatividade
Supervisão: Média
Segurança: Brincar longe da rua
Tags: calçada; amarelinha'),
('MAT-033', 'materiais', 'Lanterna', 12, 72, ARRAY['sombra', 'luz', 'reggio']::text[], 'Material: Lanterna
Categoria: Casa
Como conseguir / custo: Casa
Idade mín. (meses): 12
Idade máx. (meses): 72
Faixa etária: 1a+
Estilos de brincadeira: Luz e sombra; faz-de-conta
Ideias de atividades por idade: Teatro de sombras na parede; caçar objetos no escuro; leitura na cabana
Áreas de desenvolvimento: Curiosidade; linguagem; ciência
Supervisão: Média
Segurança: Pilhas devem ficar lacradas (risco grave se engolidas)
Tags: sombra; luz; reggio'),
('MAT-034', 'materiais', 'Contas grandes e cadarço / macarrão grosso para enfiar', 30, 72, ARRAY['enfiar', 'alinhavo']::text[], 'Material: Contas grandes e cadarço / macarrão grosso para enfiar
Categoria: Arte/motor fino
Como conseguir / custo: Papelaria ou macarrão tipo penne/rigatoni
Idade mín. (meses): 30
Idade máx. (meses): 72
Faixa etária: 2a6m+
Estilos de brincadeira: Motor fino
Ideias de atividades por idade: Enfiar em cadarço grosso ou barbante com fita na ponta
Áreas de desenvolvimento: Coordenação bimanual; concentração
Supervisão: Alta
Segurança: Contas pequenas: risco de engasgo; supervisão sempre
Tags: enfiar; alinhavo'),
('MAT-035', 'materiais', 'Canudos e palitos grossos', 24, 72, ARRAY['encaixe', 'pinça']::text[], 'Material: Canudos e palitos grossos
Categoria: Casa
Como conseguir / custo: Casa
Idade mín. (meses): 24
Idade máx. (meses): 72
Faixa etária: 2a+
Estilos de brincadeira: Motor fino; matemática
Ideias de atividades por idade: Enfiar canudos em furos de caixa/pote; enfiar na peneira virada
Áreas de desenvolvimento: Pinça; coordenação
Supervisão: Média
Segurança: Evitar palitos pontiagudos
Tags: encaixe; pinça'),
('MAT-036', 'materiais', 'Peneira, funil e escorredor', 12, 48, ARRAY['água', 'areia']::text[], 'Material: Peneira, funil e escorredor
Categoria: Cozinha
Como conseguir / custo: Cozinha
Idade mín. (meses): 12
Idade máx. (meses): 48
Faixa etária: 1a–4a
Estilos de brincadeira: Água; areia; ciência
Ideias de atividades por idade: Ver a água passar; peneirar areia; enfiar objetos nos furos
Áreas de desenvolvimento: Causa e efeito; ciência
Supervisão: Média
Tags: água; areia'),
('MAT-037', 'materiais', 'Esponjas', 9, 72, ARRAY['vida prática', 'água']::text[], 'Material: Esponjas
Categoria: Casa
Como conseguir / custo: Casa (novas)
Idade mín. (meses): 9
Idade máx. (meses): 72
Faixa etária: 9m+
Estilos de brincadeira: Água; vida prática
Ideias de atividades por idade: Espremer água de um pote a outro; limpar a mesa; carimbar tinta
Áreas de desenvolvimento: Força de mãos; vida prática
Supervisão: Média
Segurança: Não deixar morder pedaços
Tags: vida prática; água'),
('MAT-038', 'materiais', 'Pincéis e rolinhos', 12, 72, ARRAY['pintura', 'água']::text[], 'Material: Pincéis e rolinhos
Categoria: Papelaria
Como conseguir / custo: Papelaria ou loja de construção
Idade mín. (meses): 12
Idade máx. (meses): 72
Faixa etária: 1a+
Estilos de brincadeira: Arte; água
Ideias de atividades por idade: Pintar com água parede/muro; pintar papel com tinta natural
Áreas de desenvolvimento: Motor fino; coordenação
Supervisão: Média
Tags: pintura; água'),
('MAT-039', 'materiais', 'Carrinhos e rampa improvisada (tábua, papelão)', 12, 72, ARRAY['rampa', 'carrinho']::text[], 'Material: Carrinhos e rampa improvisada (tábua, papelão)
Categoria: Brinquedo + reciclável
Como conseguir / custo: Tábua ou papelão firme apoiado no sofá
Idade mín. (meses): 12
Idade máx. (meses): 72
Faixa etária: 1a+
Estilos de brincadeira: Causa e efeito; ciência
Ideias de atividades por idade: Soltar carrinhos e bolas na rampa; comparar inclinações
Áreas de desenvolvimento: Física intuitiva; previsão
Supervisão: Baixa
Segurança: Fixar a rampa
Tags: rampa; carrinho'),
('MAT-040', 'materiais', 'Livros de pano e cartonados', 0, 36, ARRAY['leitura', 'livro']::text[], 'Material: Livros de pano e cartonados
Categoria: Livros
Como conseguir / custo: Livraria, biblioteca
Idade mín. (meses): 0
Idade máx. (meses): 36
Faixa etária: 0m–3a
Estilos de brincadeira: Leitura; linguagem
Ideias de atividades por idade: Leitura compartilhada; apontar e nomear figuras; livros de textura
Áreas de desenvolvimento: Linguagem; vínculo
Supervisão: Baixa
Tags: leitura; livro'),
('MAT-041', 'materiais', 'Instrumentos caseiros (chocalho, tambor de lata, reco-reco de garrafa)', 6, 72, ARRAY['música', 'ritmo']::text[], 'Material: Instrumentos caseiros (chocalho, tambor de lata, reco-reco de garrafa)
Categoria: Música
Como conseguir / custo: Reciclável
Idade mín. (meses): 6
Idade máx. (meses): 72
Faixa etária: 6m+
Estilos de brincadeira: Musical
Ideias de atividades por idade: Acompanhar canções; marcha; ''música alta e baixa''
Áreas de desenvolvimento: Ritmo; audição; autorregulação
Supervisão: Média
Segurança: Lacrar bem chocalhos
Tags: música; ritmo'),
('MAT-042', 'materiais', 'Cestos de roupa/bacias', 9, 48, ARRAY['empurrar', 'andar']::text[], 'Material: Cestos de roupa/bacias
Categoria: Casa
Como conseguir / custo: Casa
Idade mín. (meses): 9
Idade máx. (meses): 48
Faixa etária: 9m–4a
Estilos de brincadeira: Motor grosso; faz-de-conta
Ideias de atividades por idade: Empurrar cesto como carrinho (apoio para andar); entrar e sair; barco
Áreas de desenvolvimento: Motor grosso; força
Supervisão: Média
Segurança: Cestos leves podem virar: supervisionar primeiros passos
Tags: empurrar; andar'),
('MAT-043', 'materiais', 'Túnel de tecido ou de caixas emendadas', 8, 48, ARRAY['túnel', 'engatinhar']::text[], 'Material: Túnel de tecido ou de caixas emendadas
Categoria: Casa
Como conseguir / custo: Caixas emendadas
Idade mín. (meses): 8
Idade máx. (meses): 48
Faixa etária: 8m–4a
Estilos de brincadeira: Motor grosso
Ideias de atividades por idade: Engatinhar através do túnel; esconder e reaparecer
Áreas de desenvolvimento: Motor grosso; permanência do objeto
Supervisão: Baixa
Tags: túnel; engatinhar'),
('MAT-044', 'materiais', 'Fitas e tiras de tecido', 12, 72, ARRAY['fita', 'dança']::text[], 'Material: Fitas e tiras de tecido
Categoria: Casa
Como conseguir / custo: Retalhos
Idade mín. (meses): 12
Idade máx. (meses): 72
Faixa etária: 1a+
Estilos de brincadeira: Motor grosso; dança
Ideias de atividades por idade: Dançar agitando fitas; amarrar fitas em pulseira (com adulto)
Áreas de desenvolvimento: Coordenação; música
Supervisão: Alta
Segurança: Fitas longas: risco de estrangulamento; nunca deixar no pescoço ou no berço
Tags: fita; dança'),
('MAT-045', 'materiais', 'Formas de gelo, forminhas de muffin e bandejas de ovo', 12, 72, ARRAY['classificar', 'matemática']::text[], 'Material: Formas de gelo, forminhas de muffin e bandejas de ovo
Categoria: Cozinha/reciclável
Como conseguir / custo: Cozinha; caixa de ovos de papelão
Idade mín. (meses): 12
Idade máx. (meses): 72
Faixa etária: 1a+
Estilos de brincadeira: Classificação; transferência
Ideias de atividades por idade: Separar pompons ou frutas por cor; colocar um objeto em cada espaço
Áreas de desenvolvimento: Cognitivo; correspondência 1-a-1
Supervisão: Média
Segurança: Objetos devem ter tamanho seguro para a idade
Tags: classificar; matemática'),
('MAT-046', 'materiais', 'Frutas e legumes (brincar na cozinha)', 12, 72, ARRAY['vida prática', 'montessori', 'cozinha']::text[], 'Material: Frutas e legumes (brincar na cozinha)
Categoria: Cozinha
Como conseguir / custo: Feira
Idade mín. (meses): 12
Idade máx. (meses): 72
Faixa etária: 1a+
Estilos de brincadeira: Vida prática; sensorial
Ideias de atividades por idade: Lavar legumes; descascar banana; cortar banana com faca sem ponta (2a+); carimbar com metades
Áreas de desenvolvimento: Autonomia; motor fino; interesse por comida
Supervisão: Alta
Segurança: Uso de faca sempre com adulto e ferramenta adequada
Tags: vida prática; montessori; cozinha'),
('MAT-047', 'materiais', 'Torre de aprendizagem / banquinho estável', 18, 72, ARRAY['montessori', 'autonomia']::text[], 'Material: Torre de aprendizagem / banquinho estável
Categoria: Móvel
Como conseguir / custo: Marcenaria ou pronto
Idade mín. (meses): 18
Idade máx. (meses): 72
Faixa etária: 1a6m+
Estilos de brincadeira: Vida prática
Ideias de atividades por idade: Participar da cozinha e da pia na altura do adulto
Áreas de desenvolvimento: Autonomia; linguagem; pertencimento
Supervisão: Alta
Segurança: Nunca deixar sozinho na torre
Tags: montessori; autonomia'),
('MAT-048', 'materiais', 'Cartões de figura e fotos da família', 12, 72, ARRAY['fotos', 'família', 'memória']::text[], 'Material: Cartões de figura e fotos da família
Categoria: Papelaria
Como conseguir / custo: Impressão caseira
Idade mín. (meses): 12
Idade máx. (meses): 72
Faixa etária: 1a+
Estilos de brincadeira: Linguagem; social
Ideias de atividades por idade: Nomear pessoas da família; jogo da memória simples (3a+)
Áreas de desenvolvimento: Linguagem; memória; vínculo
Supervisão: Baixa
Segurança: Plastificar para durar
Tags: fotos; família; memória'),
('MAT-049', 'materiais', 'Mantas e tapete de atividades no chão', 0, 12, ARRAY['pikler', 'movimento livre', 'tummy time']::text[], 'Material: Mantas e tapete de atividades no chão
Categoria: Casa
Como conseguir / custo: Casa
Idade mín. (meses): 0
Idade máx. (meses): 12
Faixa etária: 0m–1a
Estilos de brincadeira: Movimento livre
Ideias de atividades por idade: Espaço seguro e firme para o bebê se mover livremente, de barriga para cima e de bruços
Áreas de desenvolvimento: Motor grosso (Pikler)
Supervisão: Baixa
Segurança: Superfície firme, sem travesseiros; tummy time sempre com adulto
Tags: pikler; movimento livre; tummy time'),
('MAT-050', 'materiais', 'Bola de pilates/grande', 3, 72, ARRAY['vestibular', 'bola']::text[], 'Material: Bola de pilates/grande
Categoria: Casa
Como conseguir / custo: Loja de esportes
Idade mín. (meses): 3
Idade máx. (meses): 72
Faixa etária: 3m+
Estilos de brincadeira: Motor grosso; regulação
Ideias de atividades por idade: Bebê de bruços na bola com adulto segurando e balançando; 2a+: rolar e chutar
Áreas de desenvolvimento: Equilíbrio; vestibular
Supervisão: Alta
Segurança: Adulto segurando sempre o bebê
Tags: vestibular; bola'),
('MAT-051', 'materiais', 'Fotografias de alto contraste (preto e branco)', 0, 4, ARRAY['alto contraste', 'recém-nascido']::text[], 'Material: Fotografias de alto contraste (preto e branco)
Categoria: Papelaria
Como conseguir / custo: Imprimir
Idade mín. (meses): 0
Idade máx. (meses): 4
Faixa etária: 0m–4m
Estilos de brincadeira: Visual
Ideias de atividades por idade: Mostrar a 20–30 cm do rosto; colocar ao lado durante tummy time
Áreas de desenvolvimento: Visão; atenção
Supervisão: Baixa
Segurança: Não deixar papel no berço
Tags: alto contraste; recém-nascido'),
('MAT-052', 'materiais', 'Chocalhos e argolas de madeira', 2, 12, ARRAY['montessori', 'preensão']::text[], 'Material: Chocalhos e argolas de madeira
Categoria: Brinquedo
Como conseguir / custo: Loja ou artesanato
Idade mín. (meses): 2
Idade máx. (meses): 12
Faixa etária: 2m–1a
Estilos de brincadeira: Sensorial; preensão
Ideias de atividades por idade: Oferecer ao alcance da mão para o bebê pegar sozinho
Áreas de desenvolvimento: Preensão; causa e efeito
Supervisão: Baixa
Segurança: Verificar peças soltas e acabamento atóxico
Tags: montessori; preensão'),
('MAT-053', 'materiais', 'Cubos e blocos de madeira', 9, 72, ARRAY['empilhar', 'construção']::text[], 'Material: Cubos e blocos de madeira
Categoria: Brinquedo
Como conseguir / custo: Loja ou marcenaria
Idade mín. (meses): 9
Idade máx. (meses): 72
Faixa etária: 9m+
Estilos de brincadeira: Construção; empilhar
Ideias de atividades por idade: Empilhar e derrubar; construir torres, pontes, casas
Áreas de desenvolvimento: Motor fino; planejamento; matemática
Supervisão: Baixa
Tags: empilhar; construção'),
('MAT-054', 'materiais', 'Argila', 24, 72, ARRAY['argila', 'modelar']::text[], 'Material: Argila
Categoria: Arte natural
Como conseguir / custo: Loja de artes
Idade mín. (meses): 24
Idade máx. (meses): 72
Faixa etária: 2a+
Estilos de brincadeira: Modelagem; sensorial
Ideias de atividades por idade: Modelar livremente; marcar folhas; molhar e sentir mudar
Áreas de desenvolvimento: Força de mãos; criatividade
Supervisão: Média
Segurança: Lavar as mãos após
Tags: argila; modelar'),
('MAT-055', 'materiais', 'Terra, vasos e sementes (feijão no algodão)', 18, 72, ARRAY['plantar', 'ciência', 'natureza']::text[], 'Material: Terra, vasos e sementes (feijão no algodão)
Categoria: Natureza
Como conseguir / custo: Jardim, feira
Idade mín. (meses): 18
Idade máx. (meses): 72
Faixa etária: 1a6m+
Estilos de brincadeira: Ciência; natureza
Ideias de atividades por idade: Plantar feijão no algodão; regar plantas; mexer na terra com pá
Áreas de desenvolvimento: Ciência; responsabilidade; paciência
Supervisão: Média
Segurança: Lavar as mãos; sementes pequenas fora do alcance
Tags: plantar; ciência; natureza'),
('MAT-056', 'materiais', 'Bacia de espuma (sabão neutro)', 12, 72, ARRAY['espuma', 'banho']::text[], 'Material: Bacia de espuma (sabão neutro)
Categoria: Sensorial
Como conseguir / custo: Banho
Idade mín. (meses): 12
Idade máx. (meses): 72
Faixa etária: 1a+
Estilos de brincadeira: Sensorial; faz-de-conta
Ideias de atividades por idade: Lavar bonecos e carrinhos; ''lava-rápido''
Áreas de desenvolvimento: Sensorial; vida prática
Supervisão: Alta
Segurança: Evitar contato com os olhos; supervisão com água
Tags: espuma; banho'),
('MAT-057', 'materiais', 'Gelatina ou amido de milho com água (slime natural / oobleck)', 18, 72, ARRAY['oobleck', 'ciência']::text[], 'Material: Gelatina ou amido de milho com água (slime natural / oobleck)
Categoria: Sensorial
Como conseguir / custo: Amido de milho + água
Idade mín. (meses): 18
Idade máx. (meses): 72
Faixa etária: 1a6m+
Estilos de brincadeira: Sensorial; ciência
Ideias de atividades por idade: Pegar e ver ''derreter''; esconder bichinhos
Áreas de desenvolvimento: Sensorial; ciência
Supervisão: Média
Segurança: Usar sobre bandeja; não jogar no ralo em quantidade
Tags: oobleck; ciência'),
('MAT-058', 'materiais', 'Sacos com zíper sensoriais', 6, 24, ARRAY['saco sensorial', 'tummy time']::text[], 'Material: Sacos com zíper sensoriais
Categoria: Sensorial
Como conseguir / custo: Saco zip + gel/tinta + fita adesiva
Idade mín. (meses): 6
Idade máx. (meses): 24
Faixa etária: 6m–2a
Estilos de brincadeira: Sensorial; visual
Ideias de atividades por idade: Colar no chão ou janela; bebê aperta e move as cores
Áreas de desenvolvimento: Sensorial; motor fino
Supervisão: Alta
Segurança: Lacrar com fita; conferir furos
Tags: saco sensorial; tummy time'),
('MAT-059', 'materiais', 'Etiquetas e adesivos', 24, 72, ARRAY['adesivo', 'pinça']::text[], 'Material: Etiquetas e adesivos
Categoria: Papelaria
Como conseguir / custo: Papelaria
Idade mín. (meses): 24
Idade máx. (meses): 72
Faixa etária: 2a+
Estilos de brincadeira: Motor fino
Ideias de atividades por idade: Descolar e colar em papel ou em si mesmo
Áreas de desenvolvimento: Pinça; atenção
Supervisão: Média
Segurança: Não deixar ir à boca
Tags: adesivo; pinça'),
('MAT-060', 'materiais', 'Caixa de ovos (papelão)', 12, 72, ARRAY['reciclável', 'arte']::text[], 'Material: Caixa de ovos (papelão)
Categoria: Reciclável
Como conseguir / custo: Reciclável
Idade mín. (meses): 12
Idade máx. (meses): 72
Faixa etária: 1a+
Estilos de brincadeira: Arte; classificação
Ideias de atividades por idade: Separar objetos; pintar; fazer bichinhos
Áreas de desenvolvimento: Motor fino; criatividade
Supervisão: Média
Tags: reciclável; arte'),
('MAT-061', 'materiais', 'Pedaços de madeira e tocos lixados', 12, 72, ARRAY['madeira', 'loose parts', 'waldorf']::text[], 'Material: Pedaços de madeira e tocos lixados
Categoria: Natureza/marcenaria
Como conseguir / custo: Marcenaria
Idade mín. (meses): 12
Idade máx. (meses): 72
Faixa etária: 1a+
Estilos de brincadeira: Construção; brincar livre
Ideias de atividades por idade: Construções livres; equilíbrio de peças
Áreas de desenvolvimento: Planejamento; motor fino
Supervisão: Baixa
Segurança: Lixar bem para evitar farpas
Tags: madeira; loose parts; waldorf'),
('MAT-062', 'materiais', 'Peças soltas (loose parts) — anéis de cortina, carretéis, rolhas grandes', 18, 72, ARRAY['loose parts', 'heurístico']::text[], 'Material: Peças soltas (loose parts) — anéis de cortina, carretéis, rolhas grandes
Categoria: Heurístico
Como conseguir / custo: Casa, bazar
Idade mín. (meses): 18
Idade máx. (meses): 72
Faixa etária: 1a6m+
Estilos de brincadeira: Brincar heurístico; construção
Ideias de atividades por idade: Oferecer quantidades de cada tipo com recipientes para encher, alinhar, empilhar
Áreas de desenvolvimento: Criatividade; matemática; concentração
Supervisão: Média
Segurança: Tamanho mínimo de 4 cm até 3a
Tags: loose parts; heurístico'),
('MAT-063', 'materiais', 'Fantasias e roupas de adulto', 24, 72, ARRAY['fantasia', 'faz-de-conta']::text[], 'Material: Fantasias e roupas de adulto
Categoria: Casa
Como conseguir / custo: Roupas velhas
Idade mín. (meses): 24
Idade máx. (meses): 72
Faixa etária: 2a+
Estilos de brincadeira: Faz-de-conta
Ideias de atividades por idade: Vestir-se de profissões e personagens; brincar de casinha
Áreas de desenvolvimento: Imaginação; linguagem; autonomia no vestir
Supervisão: Baixa
Segurança: Retirar cordões compridos
Tags: fantasia; faz-de-conta'),
('MAT-064', 'materiais', 'Bonecos e bichinhos de pano', 12, 72, ARRAY['boneca', 'cuidado', 'empatia']::text[], 'Material: Bonecos e bichinhos de pano
Categoria: Brinquedo
Como conseguir / custo: Casa
Idade mín. (meses): 12
Idade máx. (meses): 72
Faixa etária: 1a+
Estilos de brincadeira: Faz-de-conta; cuidado
Ideias de atividades por idade: Dar banho, comida, colocar para dormir
Áreas de desenvolvimento: Empatia; linguagem
Supervisão: Baixa
Tags: boneca; cuidado; empatia'),
('MAT-065', 'materiais', 'Rodinhas de papelão / pratos de papel', 24, 72, ARRAY['máscara', 'arte']::text[], 'Material: Rodinhas de papelão / pratos de papel
Categoria: Reciclável/papelaria
Como conseguir / custo: Papelaria
Idade mín. (meses): 24
Idade máx. (meses): 72
Faixa etária: 2a+
Estilos de brincadeira: Arte; faz-de-conta
Ideias de atividades por idade: Máscaras; volante de carro; raquete com palito grosso
Áreas de desenvolvimento: Criatividade; motor
Supervisão: Média
Tags: máscara; arte'),
('BRI-001', 'brincadeiras', 'Meu Pintinho Amarelinho', 4, 36, ARRAY['cantiga', 'animais', 'gestos']::text[], 'Nome: Meu Pintinho Amarelinho
Tipo: Cantiga com gestos
Idade mín. (meses): 4
Idade máx. (meses): 36
Faixa etária: 4m–3a
Interesses: Animais; música; toque
Como brincar: Cantar fazendo o ''pintinho'' com a mão na palma do bebê e bicar de leve; 1a+: a criança imita os gestos
O que desenvolve: Linguagem; vínculo; imitação
Materiais: Nenhum
Onde: Casa; troca de fralda
Tags: cantiga; animais; gestos'),
('BRI-002', 'brincadeiras', 'Cadê? Achou! (esconde-esconde de rosto)', 4, 24, ARRAY['permanência do objeto', 'esconde']::text[], 'Nome: Cadê? Achou! (esconde-esconde de rosto)
Tipo: Brincadeira de colo
Idade mín. (meses): 4
Idade máx. (meses): 24
Faixa etária: 4m–2a
Interesses: Surpresa; vínculo
Como brincar: Cobrir o rosto com as mãos ou um pano e reaparecer dizendo ''achou!''; depois esconder um brinquedo sob o pano
O que desenvolve: Permanência do objeto; antecipação; vínculo
Materiais: Pano leve
Onde: Casa
Segurança: Não cobrir o rosto do bebê por tempo prolongado
Tags: permanência do objeto; esconde'),
('BRI-003', 'brincadeiras', 'Cabana', 12, 72, ARRAY['cabana', 'faz-de-conta']::text[], 'Nome: Cabana
Tipo: Faz-de-conta
Idade mín. (meses): 12
Idade máx. (meses): 72
Faixa etária: 1a+
Interesses: Aconchego; imaginação
Como brincar: Montar cabana com lençol e cadeiras; levar livros, lanterna e bichinhos
O que desenvolve: Imaginação; regulação; linguagem
Materiais: Lençol, cadeiras, almofadas
Onde: Casa
Segurança: Fixar bem o lençol
Tags: cabana; faz-de-conta'),
('BRI-004', 'brincadeiras', 'Empilhar e derrubar', 9, 48, ARRAY['empilhar', 'blocos']::text[], 'Nome: Empilhar e derrubar
Tipo: Brincadeira de construção
Idade mín. (meses): 9
Idade máx. (meses): 48
Faixa etária: 9m–4a
Interesses: Construção; causa e efeito
Como brincar: Adulto empilha, bebê derruba; depois a criança tenta empilhar 2, 3, 4 peças
O que desenvolve: Motor fino; causa e efeito; tolerância à frustração
Materiais: Blocos, potes, caixas
Onde: Casa
Tags: empilhar; blocos'),
('BRI-005', 'brincadeiras', 'Olhar no espelho', 0, 36, ARRAY['espelho', 'emoções']::text[], 'Nome: Olhar no espelho
Tipo: Social/sensorial
Idade mín. (meses): 0
Idade máx. (meses): 36
Faixa etária: 0m–3a
Interesses: Rosto; emoções
Como brincar: Colocar o bebê de bruços diante do espelho; fazer caretas e nomear emoções e partes do rosto
O que desenvolve: Autoconhecimento; emoções; linguagem
Materiais: Espelho seguro
Onde: Casa
Segurança: Espelho inquebrável
Tags: espelho; emoções'),
('BRI-006', 'brincadeiras', 'Brincadeiras com água (transferir e despejar)', 9, 72, ARRAY['água', 'sensorial']::text[], 'Nome: Brincadeiras com água (transferir e despejar)
Tipo: Sensorial
Idade mín. (meses): 9
Idade máx. (meses): 72
Faixa etária: 9m+
Interesses: Água; ciência
Como brincar: Bacia com água, copos, conchas e esponjas; encher, despejar, espremer
O que desenvolve: Motor fino; sensorial; ciência
Materiais: Bacia, copos, esponja
Onde: Quintal, banho, varanda
Segurança: Supervisão constante; esvaziar ao final
Tags: água; sensorial'),
('BRI-007', 'brincadeiras', 'Borboletinha', 6, 48, ARRAY['cantiga', 'gestos']::text[], 'Nome: Borboletinha
Tipo: Cantiga com gestos
Idade mín. (meses): 6
Idade máx. (meses): 48
Faixa etária: 6m–4a
Interesses: Animais; música
Como brincar: Cantar movendo as mãos como asas e ''voando'' pelo corpo da criança
O que desenvolve: Linguagem; ritmo; imitação
Materiais: Nenhum
Onde: Casa
Tags: cantiga; gestos'),
('BRI-008', 'brincadeiras', 'Ciranda, cirandinha', 24, 72, ARRAY['roda', 'grupo']::text[], 'Nome: Ciranda, cirandinha
Tipo: Cantiga de roda
Idade mín. (meses): 24
Idade máx. (meses): 72
Faixa etária: 2a+
Interesses: Grupo; dança
Como brincar: Roda de mãos dadas girando e parando no fim
O que desenvolve: Social; ritmo; equilíbrio
Materiais: Nenhum
Onde: Casa, parque, escola
Tags: roda; grupo'),
('BRI-009', 'brincadeiras', 'Escravos de Jó', 48, 72, ARRAY['ritmo', 'roda', 'coordenação']::text[], 'Nome: Escravos de Jó
Tipo: Jogo musical
Idade mín. (meses): 48
Idade máx. (meses): 72
Faixa etária: 4a+
Interesses: Ritmo; desafio
Como brincar: Passar objetos em roda no ritmo da cantiga, com os movimentos de ''zigue-zague''
O que desenvolve: Ritmo; atenção; coordenação
Materiais: Copos ou pedras
Onde: Mesa ou roda
Tags: ritmo; roda; coordenação'),
('BRI-010', 'brincadeiras', 'Marcha soldado', 18, 72, ARRAY['marcha', 'ritmo']::text[], 'Nome: Marcha soldado
Tipo: Cantiga com movimento
Idade mín. (meses): 18
Idade máx. (meses): 72
Faixa etária: 1a6m+
Interesses: Movimento; música
Como brincar: Marchar pela casa batendo tambor de panela
O que desenvolve: Motor grosso; ritmo
Materiais: Panela, colher
Onde: Casa, quintal
Tags: marcha; ritmo'),
('BRI-011', 'brincadeiras', 'A dona aranha', 12, 60, ARRAY['dedoche', 'gestos']::text[], 'Nome: A dona aranha
Tipo: Cantiga com gestos
Idade mín. (meses): 12
Idade máx. (meses): 60
Faixa etária: 1a–5a
Interesses: Animais; gestos
Como brincar: Subir os dedos como aranha pelo braço, fazer a chuva com os dedos e o sol com os braços
O que desenvolve: Motor fino; linguagem
Materiais: Nenhum
Onde: Casa
Tags: dedoche; gestos'),
('BRI-012', 'brincadeiras', 'Cabeça, ombro, joelho e pé', 18, 72, ARRAY['corpo', 'gestos']::text[], 'Nome: Cabeça, ombro, joelho e pé
Tipo: Cantiga com gestos
Idade mín. (meses): 18
Idade máx. (meses): 72
Faixa etária: 1a6m+
Interesses: Corpo; movimento
Como brincar: Tocar as partes do corpo acompanhando a música; acelerar o ritmo
O que desenvolve: Esquema corporal; linguagem
Materiais: Nenhum
Onde: Casa, escola
Tags: corpo; gestos'),
('BRI-013', 'brincadeiras', 'Palma, palma, palma', 9, 36, ARRAY['palmas', 'ritmo']::text[], 'Nome: Palma, palma, palma
Tipo: Cantiga com gestos
Idade mín. (meses): 9
Idade máx. (meses): 36
Faixa etária: 9m–3a
Interesses: Ritmo; imitação
Como brincar: Bater palmas, pés e mãos seguindo a cantiga
O que desenvolve: Ritmo; imitação
Materiais: Nenhum
Onde: Casa
Tags: palmas; ritmo'),
('BRI-014', 'brincadeiras', 'Serra, serra, serrador', 6, 36, ARRAY['colo', 'balanço']::text[], 'Nome: Serra, serra, serrador
Tipo: Brincadeira de colo
Idade mín. (meses): 6
Idade máx. (meses): 36
Faixa etária: 6m–3a
Interesses: Balanço; vínculo
Como brincar: Com o bebê sentado de frente no colo, segurar as mãos e balançar para frente e para trás
O que desenvolve: Vestibular; vínculo
Materiais: Nenhum
Onde: Casa
Segurança: Segurar firme; movimentos suaves com bebês que ainda não firmam o tronco
Tags: colo; balanço'),
('BRI-015', 'brincadeiras', 'Upa, upa, cavalinho', 6, 48, ARRAY['colo', 'cavalinho']::text[], 'Nome: Upa, upa, cavalinho
Tipo: Brincadeira de colo
Idade mín. (meses): 6
Idade máx. (meses): 48
Faixa etária: 6m–4a
Interesses: Balanço; ritmo
Como brincar: Criança sentada nas pernas do adulto, que ''trota'' com ritmo
O que desenvolve: Vestibular; ritmo
Materiais: Nenhum
Onde: Casa
Segurança: Nada de sacudir forte; bebê deve ter bom controle de cabeça
Tags: colo; cavalinho'),
('BRI-016', 'brincadeiras', 'Dedo mindinho, seu vizinho', 6, 36, ARRAY['dedos', 'rima']::text[], 'Nome: Dedo mindinho, seu vizinho
Tipo: Rima de dedos
Idade mín. (meses): 6
Idade máx. (meses): 36
Faixa etária: 6m–3a
Interesses: Toque; corpo
Como brincar: Nomear cada dedo tocando um por um
O que desenvolve: Esquema corporal; linguagem
Materiais: Nenhum
Onde: Casa, troca de fralda
Tags: dedos; rima'),
('BRI-017', 'brincadeiras', 'Pirulito que bate bate', 36, 72, ARRAY['jogo de mãos']::text[], 'Nome: Pirulito que bate bate
Tipo: Jogo de mãos
Idade mín. (meses): 36
Idade máx. (meses): 72
Faixa etária: 3a+
Interesses: Ritmo; parceria
Como brincar: Bater mãos em dupla seguindo a sequência
O que desenvolve: Coordenação; ritmo; memória
Materiais: Nenhum
Onde: Qualquer lugar
Tags: jogo de mãos'),
('BRI-018', 'brincadeiras', 'Sapo cururu', 12, 60, ARRAY['animais', 'pular']::text[], 'Nome: Sapo cururu
Tipo: Cantiga
Idade mín. (meses): 12
Idade máx. (meses): 60
Faixa etária: 1a–5a
Interesses: Animais; música
Como brincar: Cantar e pular como sapo
O que desenvolve: Motor grosso; linguagem
Materiais: Nenhum
Onde: Casa, quintal
Tags: animais; pular'),
('BRI-019', 'brincadeiras', 'Nana neném', 0, 36, ARRAY['ninar', 'sono']::text[], 'Nome: Nana neném
Tipo: Canção de ninar
Idade mín. (meses): 0
Idade máx. (meses): 36
Faixa etária: 0m–3a
Interesses: Ninar; calma
Como brincar: Cantar baixo e devagar embalando o bebê
O que desenvolve: Regulação; vínculo
Materiais: Nenhum
Onde: Quarto
Tags: ninar; sono'),
('BRI-020', 'brincadeiras', 'Boi da cara preta', 0, 36, ARRAY['ninar', 'sono']::text[], 'Nome: Boi da cara preta
Tipo: Canção de ninar
Idade mín. (meses): 0
Idade máx. (meses): 36
Faixa etária: 0m–3a
Interesses: Ninar
Como brincar: Cantar com voz suave durante o embalo
O que desenvolve: Regulação; vínculo
Materiais: Nenhum
Onde: Quarto
Tags: ninar; sono'),
('BRI-021', 'brincadeiras', 'Alecrim dourado', 0, 48, ARRAY['ninar', 'natureza']::text[], 'Nome: Alecrim dourado
Tipo: Canção de ninar
Idade mín. (meses): 0
Idade máx. (meses): 48
Faixa etária: 0m–4a
Interesses: Ninar; natureza
Como brincar: Cantar baixinho; pode-se cheirar um raminho de alecrim junto
O que desenvolve: Regulação; sensorial olfativo
Materiais: Alecrim (opcional)
Onde: Quarto
Tags: ninar; natureza'),
('BRI-022', 'brincadeiras', 'Fui morar numa casinha', 24, 60, ARRAY['cantiga', 'gestos']::text[], 'Nome: Fui morar numa casinha
Tipo: Cantiga com gestos
Idade mín. (meses): 24
Idade máx. (meses): 60
Faixa etária: 2a–5a
Interesses: Casa; faz-de-conta
Como brincar: Fazer os gestos da casinha e do que acontece nela
O que desenvolve: Linguagem; imitação
Materiais: Nenhum
Onde: Casa
Tags: cantiga; gestos'),
('BRI-023', 'brincadeiras', 'A canoa virou', 24, 72, ARRAY['roda', 'nomes']::text[], 'Nome: A canoa virou
Tipo: Cantiga de roda
Idade mín. (meses): 24
Idade máx. (meses): 72
Faixa etária: 2a+
Interesses: Grupo; nomes
Como brincar: Roda em que cada nome cantado ''vira'' de costas
O que desenvolve: Social; atenção; identidade
Materiais: Nenhum
Onde: Casa, escola
Tags: roda; nomes'),
('BRI-024', 'brincadeiras', 'Se essa rua fosse minha', 24, 72, ARRAY['cantiga', 'desenho']::text[], 'Nome: Se essa rua fosse minha
Tipo: Cantiga
Idade mín. (meses): 24
Idade máx. (meses): 72
Faixa etária: 2a+
Interesses: Imaginação
Como brincar: Cantar e desenhar a rua que a criança imagina
O que desenvolve: Linguagem; criatividade
Materiais: Papel e giz
Onde: Casa
Tags: cantiga; desenho'),
('BRI-025', 'brincadeiras', 'Corre cutia', 36, 72, ARRAY['grupo', 'regras', 'corrida']::text[], 'Nome: Corre cutia
Tipo: Jogo em grupo
Idade mín. (meses): 36
Idade máx. (meses): 72
Faixa etária: 3a+
Interesses: Corrida; grupo
Como brincar: Roda sentada; um corre por fora e deixa o lenço atrás de alguém
O que desenvolve: Motor grosso; atenção; regras
Materiais: Lenço
Onde: Parque, quintal
Segurança: Espaço livre de obstáculos
Tags: grupo; regras; corrida'),
('BRI-026', 'brincadeiras', 'Atirei o pau no gato (versão ''não atire'')', 18, 60, ARRAY['cantiga', 'animais', 'empatia']::text[], 'Nome: Atirei o pau no gato (versão ''não atire'')
Tipo: Cantiga
Idade mín. (meses): 18
Idade máx. (meses): 60
Faixa etária: 1a6m–5a
Interesses: Animais; empatia
Como brincar: Cantar a versão em que ninguém machuca o gato e conversar sobre cuidar dos animais
O que desenvolve: Linguagem; empatia
Materiais: Nenhum
Onde: Casa
Tags: cantiga; animais; empatia'),
('BRI-027', 'brincadeiras', 'O sapo não lava o pé', 18, 72, ARRAY['vogais', 'fonologia']::text[], 'Nome: O sapo não lava o pé
Tipo: Cantiga
Idade mín. (meses): 18
Idade máx. (meses): 72
Faixa etária: 1a6m+
Interesses: Animais; humor
Como brincar: Cantar trocando todas as vogais (a, e, i, o, u)
O que desenvolve: Consciência fonológica; humor
Materiais: Nenhum
Onde: Casa, carro
Tags: vogais; fonologia'),
('BRI-028', 'brincadeiras', 'Peixe vivo', 12, 60, ARRAY['banho', 'cantiga']::text[], 'Nome: Peixe vivo
Tipo: Cantiga
Idade mín. (meses): 12
Idade máx. (meses): 60
Faixa etária: 1a–5a
Interesses: Animais; água
Como brincar: Cantar no banho movimentando a mão como peixe
O que desenvolve: Linguagem; vínculo
Materiais: Nenhum
Onde: Banho
Tags: banho; cantiga'),
('BRI-029', 'brincadeiras', 'Indo e vindo (balanço no lençol)', 6, 48, ARRAY['balanço', 'vestibular']::text[], 'Nome: Indo e vindo (balanço no lençol)
Tipo: Brincadeira de movimento
Idade mín. (meses): 6
Idade máx. (meses): 48
Faixa etária: 6m–4a
Interesses: Balanço; vínculo
Como brincar: Dois adultos balançam a criança deitada em um lençol firme, bem baixo
O que desenvolve: Vestibular; confiança
Materiais: Lençol resistente
Onde: Casa
Segurança: Bem perto do chão, movimentos suaves
Tags: balanço; vestibular'),
('BRI-030', 'brincadeiras', 'Aviãozinho', 4, 48, ARRAY['vestibular', 'colo']::text[], 'Nome: Aviãozinho
Tipo: Brincadeira de movimento
Idade mín. (meses): 4
Idade máx. (meses): 48
Faixa etária: 4m–4a
Interesses: Movimento
Como brincar: Adulto deitado segura o bebê de bruços sobre as pernas e ''voa''
O que desenvolve: Vestibular; força de tronco
Materiais: Nenhum
Onde: Casa
Segurança: Segurar firme pelo tronco; bebê com controle de cabeça
Tags: vestibular; colo'),
('BRI-031', 'brincadeiras', 'Tummy time com brinquedo', 0, 6, ARRAY['tummy time', 'motor']::text[], 'Nome: Tummy time com brinquedo
Tipo: Brincadeira motora
Idade mín. (meses): 0
Idade máx. (meses): 6
Faixa etária: 0m–6m
Interesses: Movimento
Como brincar: Bebê de bruços no chão com brinquedo ou rosto do adulto à frente, em sessões curtas várias vezes ao dia
O que desenvolve: Força de pescoço e tronco
Materiais: Tapete, brinquedo
Onde: Casa
Segurança: Sempre acordado e com adulto presente
Tags: tummy time; motor'),
('BRI-032', 'brincadeiras', 'Rolar bolas', 8, 36, ARRAY['bola', 'turnos']::text[], 'Nome: Rolar bolas
Tipo: Brincadeira motora
Idade mín. (meses): 8
Idade máx. (meses): 36
Faixa etária: 8m–3a
Interesses: Bola; parceria
Como brincar: Sentados de frente, rolar a bola de um para o outro
O que desenvolve: Coordenação; interação; turnos
Materiais: Bola
Onde: Casa, parque
Tags: bola; turnos'),
('BRI-033', 'brincadeiras', 'Esconde-esconde', 24, 72, ARRAY['esconde', 'regras']::text[], 'Nome: Esconde-esconde
Tipo: Jogo em grupo
Idade mín. (meses): 24
Idade máx. (meses): 72
Faixa etária: 2a+
Interesses: Surpresa; corrida
Como brincar: Adulto se esconde parcialmente no início; depois a criança se esconde
O que desenvolve: Permanência; planejamento; regras
Materiais: Nenhum
Onde: Casa, quintal
Segurança: Evitar esconderijos fechados (armários, máquinas)
Tags: esconde; regras'),
('BRI-034', 'brincadeiras', 'Pega-pega', 30, 72, ARRAY['corrida', 'grupo']::text[], 'Nome: Pega-pega
Tipo: Jogo em grupo
Idade mín. (meses): 30
Idade máx. (meses): 72
Faixa etária: 2a6m+
Interesses: Corrida; grupo
Como brincar: Correr para pegar e fugir; versões com ''pique'' (lugar seguro)
O que desenvolve: Motor grosso; regras
Materiais: Nenhum
Onde: Parque, quintal
Segurança: Espaço livre
Tags: corrida; grupo'),
('BRI-035', 'brincadeiras', 'Estátua', 30, 72, ARRAY['autorregulação', 'dança']::text[], 'Nome: Estátua
Tipo: Jogo musical
Idade mín. (meses): 30
Idade máx. (meses): 72
Faixa etária: 2a6m+
Interesses: Música; controle
Como brincar: Dançar e congelar quando a música para
O que desenvolve: Autorregulação; atenção
Materiais: Música
Onde: Casa
Tags: autorregulação; dança'),
('BRI-036', 'brincadeiras', 'Dança livre', 6, 72, ARRAY['dança', 'música']::text[], 'Nome: Dança livre
Tipo: Música e movimento
Idade mín. (meses): 6
Idade máx. (meses): 72
Faixa etária: 6m+
Interesses: Música; movimento
Como brincar: Colocar músicas variadas e dançar junto, com o bebê no colo ou livre
O que desenvolve: Ritmo; motor; alegria
Materiais: Música, fitas
Onde: Casa
Tags: dança; música'),
('BRI-037', 'brincadeiras', 'Chocalho e ritmo (banda caseira)', 6, 72, ARRAY['música', 'ritmo']::text[], 'Nome: Chocalho e ritmo (banda caseira)
Tipo: Música
Idade mín. (meses): 6
Idade máx. (meses): 72
Faixa etária: 6m+
Interesses: Música; sons
Como brincar: Distribuir instrumentos caseiros e tocar forte/fraco, rápido/devagar
O que desenvolve: Ritmo; audição; autorregulação
Materiais: Instrumentos caseiros
Onde: Casa
Segurança: Lacrar chocalhos
Tags: música; ritmo'),
('BRI-038', 'brincadeiras', 'Leitura compartilhada', 0, 72, ARRAY['leitura', 'linguagem']::text[], 'Nome: Leitura compartilhada
Tipo: Leitura
Idade mín. (meses): 0
Idade máx. (meses): 72
Faixa etária: 0m+
Interesses: Livros; histórias
Como brincar: Ler apontando figuras, fazendo vozes e perguntando ''o que é isso?''
O que desenvolve: Linguagem; vínculo; atenção
Materiais: Livros
Onde: Casa, cama
Tags: leitura; linguagem'),
('BRI-039', 'brincadeiras', 'Teatro de fantoches (meias)', 18, 72, ARRAY['fantoche', 'histórias']::text[], 'Nome: Teatro de fantoches (meias)
Tipo: Faz-de-conta
Idade mín. (meses): 18
Idade máx. (meses): 72
Faixa etária: 1a6m+
Interesses: Histórias; personagens
Como brincar: Fazer fantoches com meias e contar histórias do dia
O que desenvolve: Linguagem; emoções
Materiais: Meias, canetinha
Onde: Casa
Tags: fantoche; histórias'),
('BRI-040', 'brincadeiras', 'Casinha / comidinha', 18, 72, ARRAY['faz-de-conta', 'casinha']::text[], 'Nome: Casinha / comidinha
Tipo: Faz-de-conta
Idade mín. (meses): 18
Idade máx. (meses): 72
Faixa etária: 1a6m+
Interesses: Cuidado; imitação
Como brincar: Brincar de cozinhar, servir e dar comida para bonecos
O que desenvolve: Imitação; linguagem; empatia
Materiais: Potes, panelinhas
Onde: Casa
Tags: faz-de-conta; casinha'),
('BRI-041', 'brincadeiras', 'Caça ao tesouro', 30, 72, ARRAY['caça ao tesouro']::text[], 'Nome: Caça ao tesouro
Tipo: Jogo de exploração
Idade mín. (meses): 30
Idade máx. (meses): 72
Faixa etária: 2a6m+
Interesses: Aventura; natureza
Como brincar: Esconder objetos e dar pistas; 3a+: pistas com desenhos
O que desenvolve: Atenção; linguagem; resolução de problemas
Materiais: Objetos, pistas desenhadas
Onde: Casa, parque
Tags: caça ao tesouro'),
('BRI-042', 'brincadeiras', 'Percurso de obstáculos', 12, 72, ARRAY['percurso', 'motor grosso']::text[], 'Nome: Percurso de obstáculos
Tipo: Brincadeira motora
Idade mín. (meses): 12
Idade máx. (meses): 72
Faixa etária: 1a+
Interesses: Movimento; desafio
Como brincar: Montar trajeto com almofadas, túnel, fita no chão para passar por cima, por baixo e por dentro
O que desenvolve: Motor grosso; planejamento; noção espacial
Materiais: Almofadas, caixas, fita
Onde: Casa
Segurança: Remover quinas e objetos soltos
Tags: percurso; motor grosso'),
('BRI-043', 'brincadeiras', 'Pular na cama elástica ou colchão', 24, 72, ARRAY['pular']::text[], 'Nome: Pular na cama elástica ou colchão
Tipo: Brincadeira motora
Idade mín. (meses): 24
Idade máx. (meses): 72
Faixa etária: 2a+
Interesses: Pular
Como brincar: Pular segurando a mão do adulto; contar os pulos
O que desenvolve: Força; equilíbrio
Materiais: Colchão no chão
Onde: Casa
Segurança: Colchão no chão, longe de paredes
Tags: pular'),
('BRI-044', 'brincadeiras', 'Amarelinha', 42, 72, ARRAY['amarelinha', 'números']::text[], 'Nome: Amarelinha
Tipo: Jogo tradicional
Idade mín. (meses): 42
Idade máx. (meses): 72
Faixa etária: 3a6m+
Interesses: Pular; números
Como brincar: Desenhar no chão e pular nos quadrados
O que desenvolve: Equilíbrio; números
Materiais: Giz
Onde: Calçada, quintal
Tags: amarelinha; números'),
('BRI-045', 'brincadeiras', 'Bambolê', 24, 72, ARRAY['bambolê']::text[], 'Nome: Bambolê
Tipo: Brincadeira motora
Idade mín. (meses): 24
Idade máx. (meses): 72
Faixa etária: 2a+
Interesses: Movimento
Como brincar: Pular dentro e fora; usar como volante; rolar
O que desenvolve: Motor grosso
Materiais: Bambolê
Onde: Quintal
Tags: bambolê'),
('BRI-046', 'brincadeiras', 'Morto-vivo', 30, 72, ARRAY['comando', 'atenção']::text[], 'Nome: Morto-vivo
Tipo: Jogo de comando
Idade mín. (meses): 30
Idade máx. (meses): 72
Faixa etária: 2a6m+
Interesses: Atenção; humor
Como brincar: Abaixar e levantar conforme o comando
O que desenvolve: Atenção; autorregulação
Materiais: Nenhum
Onde: Qualquer lugar
Tags: comando; atenção'),
('BRI-047', 'brincadeiras', 'Seu mestre mandou', 36, 72, ARRAY['comando', 'regras']::text[], 'Nome: Seu mestre mandou
Tipo: Jogo de comando
Idade mín. (meses): 36
Idade máx. (meses): 72
Faixa etária: 3a+
Interesses: Regras; imitação
Como brincar: Imitar os comandos do ''mestre''; revezar o papel
O que desenvolve: Atenção; linguagem; regras
Materiais: Nenhum
Onde: Qualquer lugar
Tags: comando; regras'),
('BRI-048', 'brincadeiras', 'Boliche de garrafa PET', 24, 72, ARRAY['boliche', 'reciclável']::text[], 'Nome: Boliche de garrafa PET
Tipo: Jogo motor
Idade mín. (meses): 24
Idade máx. (meses): 72
Faixa etária: 2a+
Interesses: Bola; desafio
Como brincar: Arrumar garrafas e derrubar rolando uma bola
O que desenvolve: Coordenação; contagem
Materiais: Garrafas PET, bola
Onde: Casa, quintal
Tags: boliche; reciclável'),
('BRI-049', 'brincadeiras', 'Bolhas de sabão', 6, 72, ARRAY['bolhas']::text[], 'Nome: Bolhas de sabão
Tipo: Brincadeira sensorial
Idade mín. (meses): 6
Idade máx. (meses): 72
Faixa etária: 6m+
Interesses: Ar livre; surpresa
Como brincar: Adulto sopra e a criança persegue e estoura
O que desenvolve: Rastreamento visual; motor; sopro
Materiais: Bolhas
Onde: Quintal, parque
Segurança: Não beber a solução
Tags: bolhas'),
('BRI-050', 'brincadeiras', 'Massagem com cantiga', 0, 24, ARRAY['massagem', 'shantala']::text[], 'Nome: Massagem com cantiga
Tipo: Toque/afeto
Idade mín. (meses): 0
Idade máx. (meses): 24
Faixa etária: 0m–2a
Interesses: Relaxar; vínculo
Como brincar: Massagear pernas, barriga e braços cantando devagar
O que desenvolve: Vínculo; regulação; consciência corporal
Materiais: Óleo vegetal (opcional)
Onde: Casa
Segurança: Evitar óleos com perfume
Tags: massagem; shantala'),
('BRI-051', 'brincadeiras', 'Brincadeira da janela (olhar e nomear)', 6, 36, ARRAY['linguagem', 'observação']::text[], 'Nome: Brincadeira da janela (olhar e nomear)
Tipo: Linguagem
Idade mín. (meses): 6
Idade máx. (meses): 36
Faixa etária: 6m–3a
Interesses: Rua; observação
Como brincar: Olhar pela janela e nomear carros, pássaros, pessoas, cores
O que desenvolve: Linguagem; atenção
Materiais: Nenhum
Onde: Casa
Segurança: Janela com tela/grade
Tags: linguagem; observação'),
('BRI-052', 'brincadeiras', 'Imitar sons de bichos', 9, 48, ARRAY['animais', 'sons', 'fala']::text[], 'Nome: Imitar sons de bichos
Tipo: Linguagem
Idade mín. (meses): 9
Idade máx. (meses): 48
Faixa etária: 9m–4a
Interesses: Animais; sons
Como brincar: Mostrar figura ou bicho de pelúcia e fazer o som; esperar a criança imitar
O que desenvolve: Fala; imitação
Materiais: Livro de animais
Onde: Qualquer lugar
Tags: animais; sons; fala'),
('BRI-053', 'brincadeiras', 'Telefone de copo', 36, 72, ARRAY['telefone', 'ciência']::text[], 'Nome: Telefone de copo
Tipo: Faz-de-conta/ciência
Idade mín. (meses): 36
Idade máx. (meses): 72
Faixa etária: 3a+
Interesses: Ciência; conversa
Como brincar: Dois copos ligados por barbante esticado para ''telefonar''
O que desenvolve: Linguagem; ciência
Materiais: Copos, barbante
Onde: Casa
Segurança: Barbante só com supervisão
Tags: telefone; ciência'),
('BRI-054', 'brincadeiras', 'Teatro de sombras', 24, 72, ARRAY['sombra', 'histórias']::text[], 'Nome: Teatro de sombras
Tipo: Luz e sombra
Idade mín. (meses): 24
Idade máx. (meses): 72
Faixa etária: 2a+
Interesses: Luz; histórias
Como brincar: Lanterna e mãos ou recortes projetando sombras na parede
O que desenvolve: Imaginação; linguagem
Materiais: Lanterna
Onde: Quarto escuro
Tags: sombra; histórias'),
('BRI-055', 'brincadeiras', 'Encher e esvaziar (cesto e bolas)', 9, 24, ARRAY['encher esvaziar', 'esquemas']::text[], 'Nome: Encher e esvaziar (cesto e bolas)
Tipo: Exploração
Idade mín. (meses): 9
Idade máx. (meses): 24
Faixa etária: 9m–2a
Interesses: Exploração
Como brincar: Oferecer recipiente e objetos para colocar e tirar repetidamente
O que desenvolve: Motor fino; esquema de ''dentro e fora''
Materiais: Cesto, bolas de meia
Onde: Casa
Segurança: Objetos maiores que 4 cm
Tags: encher esvaziar; esquemas'),
('BRI-056', 'brincadeiras', 'Puxar lenços da caixa', 8, 20, ARRAY['pinça', 'puxar']::text[], 'Nome: Puxar lenços da caixa
Tipo: Exploração
Idade mín. (meses): 8
Idade máx. (meses): 20
Faixa etária: 8m–1a8m
Interesses: Surpresa; mãos
Como brincar: Caixa de lenços vazia com panos coloridos para puxar
O que desenvolve: Pinça; causa e efeito
Materiais: Caixa, lenços
Onde: Casa
Tags: pinça; puxar'),
('BRI-057', 'brincadeiras', 'Brincar de ''Onde está o…?'' (partes do corpo)', 12, 36, ARRAY['corpo', 'linguagem']::text[], 'Nome: Brincar de ''Onde está o…?'' (partes do corpo)
Tipo: Linguagem
Idade mín. (meses): 12
Idade máx. (meses): 36
Faixa etária: 1a–3a
Interesses: Corpo
Como brincar: Perguntar ''cadê o nariz?'' e ajudar a apontar
O que desenvolve: Linguagem receptiva; esquema corporal
Materiais: Nenhum
Onde: Qualquer lugar
Tags: corpo; linguagem'),
('BRI-058', 'brincadeiras', 'Pintura com água no muro', 12, 60, ARRAY['água', 'pintura']::text[], 'Nome: Pintura com água no muro
Tipo: Arte ao ar livre
Idade mín. (meses): 12
Idade máx. (meses): 60
Faixa etária: 1a–5a
Interesses: Arte; água
Como brincar: Pincel e balde com água para ''pintar'' parede, chão ou muro e ver secar
O que desenvolve: Motor; ciência
Materiais: Pincel, balde
Onde: Quintal
Segurança: Supervisão com água
Tags: água; pintura'),
('BRI-059', 'brincadeiras', 'Caixa surpresa (tato)', 30, 72, ARRAY['tato', 'adivinhar']::text[], 'Nome: Caixa surpresa (tato)
Tipo: Sensorial
Idade mín. (meses): 30
Idade máx. (meses): 72
Faixa etária: 2a6m+
Interesses: Mistério
Como brincar: Colocar objetos em saco de pano e adivinhar pelo tato
O que desenvolve: Sensorial; linguagem
Materiais: Saco de pano, objetos
Onde: Casa
Tags: tato; adivinhar'),
('BRI-060', 'brincadeiras', 'Guerra de travesseiros leve', 36, 72, ARRAY['energia', 'brincadeira bruta']::text[], 'Nome: Guerra de travesseiros leve
Tipo: Motor/afeto
Idade mín. (meses): 36
Idade máx. (meses): 72
Faixa etária: 3a+
Interesses: Humor; energia
Como brincar: Batalha com almofadas macias com regra de não acertar o rosto
O que desenvolve: Regulação de força; vínculo
Materiais: Almofadas
Onde: Casa
Segurança: Regras claras
Tags: energia; brincadeira bruta'),
('BRI-061', 'brincadeiras', 'Brincadeira bruta segura (rough and tumble)', 18, 72, ARRAY['brincadeira bruta', 'regulação']::text[], 'Nome: Brincadeira bruta segura (rough and tumble)
Tipo: Motor/afeto
Idade mín. (meses): 18
Idade máx. (meses): 72
Faixa etária: 1a6m+
Interesses: Energia; corpo
Como brincar: Rolar, empurrar e lutar de brincadeira no colchão com adulto, parando quando a criança pede
O que desenvolve: Autorregulação; confiança
Materiais: Colchão
Onde: Casa
Segurança: Parar ao primeiro ''pare''
Tags: brincadeira bruta; regulação'),
('BRI-062', 'brincadeiras', 'Bola no cesto', 12, 72, ARRAY['arremesso']::text[], 'Nome: Bola no cesto
Tipo: Motor
Idade mín. (meses): 12
Idade máx. (meses): 72
Faixa etária: 1a+
Interesses: Arremesso
Como brincar: Jogar bolas de meia no cesto de roupa a distâncias diferentes
O que desenvolve: Coordenação; força
Materiais: Cesto, meias
Onde: Casa
Tags: arremesso'),
('BRI-063', 'brincadeiras', 'Seguir a linha de fita crepe', 18, 60, ARRAY['equilíbrio', 'fita']::text[], 'Nome: Seguir a linha de fita crepe
Tipo: Motor
Idade mín. (meses): 18
Idade máx. (meses): 60
Faixa etária: 1a6m–5a
Interesses: Equilíbrio
Como brincar: Andar sobre a linha, pular de lado, andar de costas
O que desenvolve: Equilíbrio; coordenação
Materiais: Fita crepe
Onde: Casa
Tags: equilíbrio; fita'),
('BRI-064', 'brincadeiras', 'Batata quente', 30, 72, ARRAY['grupo', 'ritmo']::text[], 'Nome: Batata quente
Tipo: Jogo em grupo
Idade mín. (meses): 30
Idade máx. (meses): 72
Faixa etária: 2a6m+
Interesses: Ritmo; grupo
Como brincar: Passar a bola rapidamente enquanto alguém canta; quem estiver com a bola no fim faz uma careta
O que desenvolve: Coordenação; atenção
Materiais: Bola
Onde: Casa, festa
Tags: grupo; ritmo'),
('BRI-065', 'brincadeiras', 'Cantar a rotina', 6, 48, ARRAY['rotina', 'cooperação']::text[], 'Nome: Cantar a rotina
Tipo: Música/rotina
Idade mín. (meses): 6
Idade máx. (meses): 48
Faixa etária: 6m–4a
Interesses: Rotina
Como brincar: Criar pequenas canções para escovar os dentes, guardar os brinquedos, tomar banho
O que desenvolve: Previsibilidade; cooperação
Materiais: Nenhum
Onde: Casa
Tags: rotina; cooperação'),
('BRI-066', 'brincadeiras', 'Siga o mestre na natureza', 24, 72, ARRAY['natureza', 'imitação']::text[], 'Nome: Siga o mestre na natureza
Tipo: Exploração
Idade mín. (meses): 24
Idade máx. (meses): 72
Faixa etária: 2a+
Interesses: Natureza
Como brincar: Seguir um adulto imitando movimentos de bichos pelo parque
O que desenvolve: Motor grosso; imaginação
Materiais: Nenhum
Onde: Parque
Tags: natureza; imitação'),
('BRI-067', 'brincadeiras', 'Coleta de tesouros no passeio', 18, 72, ARRAY['natureza', 'coleção']::text[], 'Nome: Coleta de tesouros no passeio
Tipo: Exploração
Idade mín. (meses): 18
Idade máx. (meses): 72
Faixa etária: 1a6m+
Interesses: Natureza; coleção
Como brincar: Levar saquinho e coletar folhas, flores caídas e pedrinhas; em casa, separar e montar quadro
O que desenvolve: Classificação; linguagem
Materiais: Saquinho
Onde: Parque, praça
Segurança: Itens pequenos só para maiores de 3a
Tags: natureza; coleção'),
('BRI-068', 'brincadeiras', 'Carrinho de mão', 36, 72, ARRAY['força', 'motor grosso']::text[], 'Nome: Carrinho de mão
Tipo: Motor
Idade mín. (meses): 36
Idade máx. (meses): 72
Faixa etária: 3a+
Interesses: Força
Como brincar: Adulto segura as pernas da criança que ''anda'' com as mãos
O que desenvolve: Força de braços e tronco
Materiais: Nenhum
Onde: Grama, tapete
Segurança: Distâncias curtas
Tags: força; motor grosso'),
('BRI-069', 'brincadeiras', 'Esconder brinquedo sob copos', 10, 36, ARRAY['memória', 'permanência']::text[], 'Nome: Esconder brinquedo sob copos
Tipo: Cognitivo
Idade mín. (meses): 10
Idade máx. (meses): 36
Faixa etária: 10m–3a
Interesses: Desafio
Como brincar: Esconder objeto sob um de dois ou três copos e deixar achar
O que desenvolve: Memória; permanência do objeto
Materiais: Copos opacos
Onde: Casa
Tags: memória; permanência'),
('BRI-070', 'brincadeiras', 'Brincar de sombra no sol', 18, 72, ARRAY['sombra', 'ciência']::text[], 'Nome: Brincar de sombra no sol
Tipo: Exploração
Idade mín. (meses): 18
Idade máx. (meses): 72
Faixa etária: 1a6m+
Interesses: Sol; corpo
Como brincar: Pisar na sombra do outro; desenhar sombra no chão com giz
O que desenvolve: Noção corporal; ciência
Materiais: Giz
Onde: Calçada
Segurança: Evitar sol forte das 10h às 16h
Tags: sombra; ciência'),
('BRI-071', 'brincadeiras', 'Soprar pena ou bolinha de algodão', 24, 72, ARRAY['sopro', 'fala']::text[], 'Nome: Soprar pena ou bolinha de algodão
Tipo: Linguagem/motor oral
Idade mín. (meses): 24
Idade máx. (meses): 72
Faixa etária: 2a+
Interesses: Sopro
Como brincar: Soprar objetos leves pela mesa até um ''gol''
O que desenvolve: Motricidade oral (fala); respiração
Materiais: Pena, algodão, canudo
Onde: Mesa
Tags: sopro; fala'),
('BRI-072', 'brincadeiras', 'Brincar no banho com potes', 6, 48, ARRAY['banho', 'água']::text[], 'Nome: Brincar no banho com potes
Tipo: Sensorial
Idade mín. (meses): 6
Idade máx. (meses): 48
Faixa etária: 6m–4a
Interesses: Água
Como brincar: Potes, peneiras e bonecos na banheira; despejar água
O que desenvolve: Sensorial; causa e efeito
Materiais: Potes
Onde: Banho
Segurança: Nunca deixar sozinho no banho
Tags: banho; água'),
('BRI-073', 'brincadeiras', 'Música de roda com nomes', 12, 72, ARRAY['nomes', 'identidade']::text[], 'Nome: Música de roda com nomes
Tipo: Social
Idade mín. (meses): 12
Idade máx. (meses): 72
Faixa etária: 1a+
Interesses: Nomes; grupo
Como brincar: Incluir o nome da criança e de familiares em canções conhecidas
O que desenvolve: Identidade; vínculo; linguagem
Materiais: Nenhum
Onde: Qualquer lugar
Tags: nomes; identidade'),
('BRI-074', 'brincadeiras', 'Quebra-cabeça de encaixe', 12, 72, ARRAY['encaixe', 'quebra-cabeça']::text[], 'Nome: Quebra-cabeça de encaixe
Tipo: Cognitivo
Idade mín. (meses): 12
Idade máx. (meses): 72
Faixa etária: 1a+
Interesses: Desafio
Como brincar: Começar com peças grandes com pino; aumentar a dificuldade
O que desenvolve: Resolução de problemas; motor fino
Materiais: Quebra-cabeça
Onde: Casa
Tags: encaixe; quebra-cabeça'),
('BRI-075', 'brincadeiras', 'Jogo da memória simples', 36, 72, ARRAY['memória', 'jogo']::text[], 'Nome: Jogo da memória simples
Tipo: Cognitivo
Idade mín. (meses): 36
Idade máx. (meses): 72
Faixa etária: 3a+
Interesses: Desafio
Como brincar: Começar com 3–4 pares virados para cima, depois para baixo
O que desenvolve: Memória; atenção; turnos
Materiais: Cartas
Onde: Mesa
Tags: memória; jogo'),
('BRI-076', 'brincadeiras', 'Lavar louça de brinquedo / bonecos', 18, 60, ARRAY['vida prática', 'montessori']::text[], 'Nome: Lavar louça de brinquedo / bonecos
Tipo: Vida prática
Idade mín. (meses): 18
Idade máx. (meses): 60
Faixa etária: 1a6m–5a
Interesses: Água; cuidado
Como brincar: Bacia com água e esponja para lavar potes e bonecos
O que desenvolve: Vida prática; motor fino
Materiais: Bacia, esponja
Onde: Varanda, cozinha
Segurança: Supervisão com água
Tags: vida prática; montessori'),
('BRI-077', 'brincadeiras', 'Balançar no balanço', 9, 72, ARRAY['parque', 'vestibular']::text[], 'Nome: Balançar no balanço
Tipo: Motor/vestibular
Idade mín. (meses): 9
Idade máx. (meses): 72
Faixa etária: 9m+
Interesses: Parque; movimento
Como brincar: Balanço com assento de bebê ou no colo; empurrões suaves
O que desenvolve: Vestibular; regulação
Materiais: Balanço
Onde: Parque
Segurança: Assento adequado à idade
Tags: parque; vestibular'),
('BRI-078', 'brincadeiras', 'Andar descalço em texturas', 12, 72, ARRAY['descalço', 'sensorial']::text[], 'Nome: Andar descalço em texturas
Tipo: Sensorial
Idade mín. (meses): 12
Idade máx. (meses): 72
Faixa etária: 1a+
Interesses: Natureza; corpo
Como brincar: Grama, areia, terra, folhas: caminhar descalço e nomear sensações
O que desenvolve: Sensorial; equilíbrio
Materiais: Nenhum
Onde: Parque, quintal
Segurança: Checar o chão (vidro, espinhos)
Tags: descalço; sensorial'),
('BRI-079', 'brincadeiras', 'Carimbos com legumes', 18, 72, ARRAY['arte', 'carimbo']::text[], 'Nome: Carimbos com legumes
Tipo: Arte
Idade mín. (meses): 18
Idade máx. (meses): 72
Faixa etária: 1a6m+
Interesses: Arte; cozinha
Como brincar: Cortar legumes ao meio e carimbar com tinta natural
O que desenvolve: Criatividade; motor fino
Materiais: Legumes, tinta
Onde: Mesa
Tags: arte; carimbo'),
('BRI-080', 'brincadeiras', 'Caminhada do bicho (imitar animais)', 24, 72, ARRAY['animais', 'motor grosso']::text[], 'Nome: Caminhada do bicho (imitar animais)
Tipo: Motor
Idade mín. (meses): 24
Idade máx. (meses): 72
Faixa etária: 2a+
Interesses: Animais; movimento
Como brincar: Andar como urso, sapo, caranguejo, cobra
O que desenvolve: Motor grosso; imaginação
Materiais: Nenhum
Onde: Casa, parque
Tags: animais; motor grosso'),
('BRI-081', 'brincadeiras', 'Adivinha o som', 24, 72, ARRAY['sons', 'audição']::text[], 'Nome: Adivinha o som
Tipo: Audição
Idade mín. (meses): 24
Idade máx. (meses): 72
Faixa etária: 2a+
Interesses: Sons
Como brincar: Fechar os olhos e adivinhar o som (água, chave, palmas, papel)
O que desenvolve: Atenção auditiva; linguagem
Materiais: Objetos da casa
Onde: Casa
Tags: sons; audição'),
('BRI-082', 'brincadeiras', 'Contação de histórias inventadas', 30, 72, ARRAY['histórias', 'imaginação']::text[], 'Nome: Contação de histórias inventadas
Tipo: Linguagem
Idade mín. (meses): 30
Idade máx. (meses): 72
Faixa etária: 2a6m+
Interesses: Histórias
Como brincar: Adulto começa uma história e a criança completa; incluir a própria criança como personagem
O que desenvolve: Linguagem; imaginação
Materiais: Nenhum
Onde: Cama, carro
Tags: histórias; imaginação'),
('BRI-083', 'brincadeiras', 'Tambor na barriga (ritmo no corpo)', 3, 24, ARRAY['toque', 'ritmo']::text[], 'Nome: Tambor na barriga (ritmo no corpo)
Tipo: Música/toque
Idade mín. (meses): 3
Idade máx. (meses): 24
Faixa etária: 3m–2a
Interesses: Toque; ritmo
Como brincar: Batucar de leve na barriga, pés e mãos do bebê cantando
O que desenvolve: Vínculo; ritmo
Materiais: Nenhum
Onde: Casa, troca
Tags: toque; ritmo'),
('BRI-084', 'brincadeiras', 'Pintinho e raposa (versão pega-pega)', 36, 72, ARRAY['grupo', 'corrida']::text[], 'Nome: Pintinho e raposa (versão pega-pega)
Tipo: Jogo em grupo
Idade mín. (meses): 36
Idade máx. (meses): 72
Faixa etária: 3a+
Interesses: Corrida; grupo
Como brincar: Uma ''raposa'' tenta pegar os ''pintinhos'' que se protegem atrás da ''galinha''
O que desenvolve: Motor grosso; cooperação
Materiais: Nenhum
Onde: Parque, quintal
Segurança: Espaço livre
Tags: grupo; corrida'),
('ALI-001', 'alimentos', 'Banana nanica', 6, NULL, NULL, 'Alimento: Banana nanica
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Amassada com garfo, sem peneirar nem liquidificar
BLW / BLISS (6–8m): Em tiras do tamanho de um dedo adulto; deixar parte da casca para facilitar a pegada quando possível
9–11m (pinça, todas as abordagens): Pedaços pequenos e macios para pegar com a pinça
12m+ (mesa da família): Em pedaços, fatias ou inteira, na mesa com a família
Risco de engasgo: Baixo
Destaque nutricional: Energia, potássio
Cuidados / observações: Descascar deixando parte da casca como cabo
Status: Oferecer'),
('ALI-002', 'alimentos', 'Banana prata', 6, NULL, NULL, 'Alimento: Banana prata
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Amassada com garfo, sem peneirar nem liquidificar
BLW / BLISS (6–8m): Em tiras do tamanho de um dedo adulto; deixar parte da casca para facilitar a pegada quando possível
9–11m (pinça, todas as abordagens): Pedaços pequenos e macios para pegar com a pinça
12m+ (mesa da família): Em pedaços, fatias ou inteira, na mesa com a família
Risco de engasgo: Baixo
Destaque nutricional: Energia, potássio
Status: Oferecer'),
('ALI-003', 'alimentos', 'Banana-da-terra', 6, NULL, NULL, 'Alimento: Banana-da-terra
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Amassada com garfo, sem peneirar nem liquidificar
BLW / BLISS (6–8m): Em tiras do tamanho de um dedo adulto; deixar parte da casca para facilitar a pegada quando possível
9–11m (pinça, todas as abordagens): Pedaços pequenos e macios para pegar com a pinça
12m+ (mesa da família): Em pedaços, fatias ou inteira, na mesa com a família
Risco de engasgo: Baixo
Destaque nutricional: Energia, fibras
Cuidados / observações: Oferecer cozida ou assada (crua é adstringente)
Status: Oferecer'),
('ALI-004', 'alimentos', 'Abacate', 6, NULL, NULL, 'Alimento: Abacate
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Amassada com garfo, sem peneirar nem liquidificar
BLW / BLISS (6–8m): Em tiras do tamanho de um dedo adulto; deixar parte da casca para facilitar a pegada quando possível
9–11m (pinça, todas as abordagens): Pedaços pequenos e macios para pegar com a pinça
12m+ (mesa da família): Em pedaços, fatias ou inteira, na mesa com a família
Risco de engasgo: Baixo
Destaque nutricional: Gorduras boas, energia
Cuidados / observações: Pode passar em farinha de aveia para não escorregar
Status: Oferecer'),
('ALI-005', 'alimentos', 'Manga', 6, NULL, NULL, 'Alimento: Manga
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Amassada com garfo, sem peneirar nem liquidificar
BLW / BLISS (6–8m): Em tiras do tamanho de um dedo adulto; deixar parte da casca para facilitar a pegada quando possível
9–11m (pinça, todas as abordagens): Pedaços pequenos e macios para pegar com a pinça
12m+ (mesa da família): Em pedaços, fatias ou inteira, na mesa com a família
Risco de engasgo: Baixo
Destaque nutricional: Vitamina A e C
Cuidados / observações: Oferecer o caroço limpo e com pouca polpa para roer
Status: Oferecer'),
('ALI-006', 'alimentos', 'Mamão papaia', 6, NULL, NULL, 'Alimento: Mamão papaia
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Amassada com garfo, sem peneirar nem liquidificar
BLW / BLISS (6–8m): Em tiras do tamanho de um dedo adulto; deixar parte da casca para facilitar a pegada quando possível
9–11m (pinça, todas as abordagens): Pedaços pequenos e macios para pegar com a pinça
12m+ (mesa da família): Em pedaços, fatias ou inteira, na mesa com a família
Risco de engasgo: Baixo
Destaque nutricional: Vitamina A e C, fibras
Status: Oferecer'),
('ALI-007', 'alimentos', 'Mamão formosa', 6, NULL, NULL, 'Alimento: Mamão formosa
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Amassada com garfo, sem peneirar nem liquidificar
BLW / BLISS (6–8m): Em tiras do tamanho de um dedo adulto; deixar parte da casca para facilitar a pegada quando possível
9–11m (pinça, todas as abordagens): Pedaços pequenos e macios para pegar com a pinça
12m+ (mesa da família): Em pedaços, fatias ou inteira, na mesa com a família
Risco de engasgo: Baixo
Destaque nutricional: Vitamina A e C
Status: Oferecer'),
('ALI-008', 'alimentos', 'Pera', 6, NULL, NULL, 'Alimento: Pera
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Raspada com colher ou cozida e amassada
BLW / BLISS (6–8m): Cozida no vapor até amassar entre os dedos, em fatias grossas
9–11m (pinça, todas as abordagens): Cozida em cubinhos ou crua ralada fina
12m+ (mesa da família): Fatias finas cruas; seguir oferecendo com supervisão
Risco de engasgo: Alto (crua)
Destaque nutricional: Fibras
Cuidados / observações: Madura bem macia pode ser oferecida crua em tiras
Status: Oferecer'),
('ALI-009', 'alimentos', 'Maçã', 6, NULL, NULL, 'Alimento: Maçã
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Raspada com colher ou cozida e amassada
BLW / BLISS (6–8m): Cozida no vapor até amassar entre os dedos, em fatias grossas
9–11m (pinça, todas as abordagens): Cozida em cubinhos ou crua ralada fina
12m+ (mesa da família): Fatias finas cruas; seguir oferecendo com supervisão
Risco de engasgo: Alto (crua)
Destaque nutricional: Fibras
Cuidados / observações: Crua em pedaços é um dos principais riscos de engasgo
Status: Oferecer'),
('ALI-010', 'alimentos', 'Goiaba', 6, NULL, NULL, 'Alimento: Goiaba
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Amassada com garfo, sem peneirar nem liquidificar
BLW / BLISS (6–8m): Em tiras do tamanho de um dedo adulto; deixar parte da casca para facilitar a pegada quando possível
9–11m (pinça, todas as abordagens): Pedaços pequenos e macios para pegar com a pinça
12m+ (mesa da família): Em pedaços, fatias ou inteira, na mesa com a família
Risco de engasgo: Baixo
Destaque nutricional: Vitamina C (ajuda a absorver ferro)
Cuidados / observações: Retirar sementes para menores de 1 ano ou oferecer em tiras da casca sem o miolo
Status: Oferecer'),
('ALI-011', 'alimentos', 'Kiwi', 6, NULL, NULL, 'Alimento: Kiwi
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Amassada com garfo, sem peneirar nem liquidificar
BLW / BLISS (6–8m): Em tiras do tamanho de um dedo adulto; deixar parte da casca para facilitar a pegada quando possível
9–11m (pinça, todas as abordagens): Pedaços pequenos e macios para pegar com a pinça
12m+ (mesa da família): Em pedaços, fatias ou inteira, na mesa com a família
Alergênico: Kiwi (pode causar reação)
Risco de engasgo: Baixo
Destaque nutricional: Vitamina C
Cuidados / observações: Observar vermelhidão em volta da boca
Status: Oferecer'),
('ALI-012', 'alimentos', 'Pêssego', 6, NULL, NULL, 'Alimento: Pêssego
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Amassada com garfo, sem peneirar nem liquidificar
BLW / BLISS (6–8m): Em tiras do tamanho de um dedo adulto; deixar parte da casca para facilitar a pegada quando possível
9–11m (pinça, todas as abordagens): Pedaços pequenos e macios para pegar com a pinça
12m+ (mesa da família): Em pedaços, fatias ou inteira, na mesa com a família
Risco de engasgo: Baixo
Destaque nutricional: Vitamina A
Cuidados / observações: Maduro; retirar caroço
Status: Oferecer'),
('ALI-013', 'alimentos', 'Ameixa fresca', 6, NULL, NULL, 'Alimento: Ameixa fresca
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Amassada com garfo, sem peneirar nem liquidificar
BLW / BLISS (6–8m): Em tiras do tamanho de um dedo adulto; deixar parte da casca para facilitar a pegada quando possível
9–11m (pinça, todas as abordagens): Pedaços pequenos e macios para pegar com a pinça
12m+ (mesa da família): Em pedaços, fatias ou inteira, na mesa com a família
Risco de engasgo: Baixo
Destaque nutricional: Fibras
Cuidados / observações: Sem caroço
Status: Oferecer'),
('ALI-014', 'alimentos', 'Nectarina', 6, NULL, NULL, 'Alimento: Nectarina
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Amassada com garfo, sem peneirar nem liquidificar
BLW / BLISS (6–8m): Em tiras do tamanho de um dedo adulto; deixar parte da casca para facilitar a pegada quando possível
9–11m (pinça, todas as abordagens): Pedaços pequenos e macios para pegar com a pinça
12m+ (mesa da família): Em pedaços, fatias ou inteira, na mesa com a família
Risco de engasgo: Baixo
Destaque nutricional: Vitamina A e C
Cuidados / observações: Sem caroço
Status: Oferecer'),
('ALI-015', 'alimentos', 'Caqui', 6, NULL, NULL, 'Alimento: Caqui
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Amassada com garfo, sem peneirar nem liquidificar
BLW / BLISS (6–8m): Em tiras do tamanho de um dedo adulto; deixar parte da casca para facilitar a pegada quando possível
9–11m (pinça, todas as abordagens): Pedaços pequenos e macios para pegar com a pinça
12m+ (mesa da família): Em pedaços, fatias ou inteira, na mesa com a família
Risco de engasgo: Baixo
Destaque nutricional: Vitamina A
Cuidados / observações: Bem maduro
Status: Oferecer'),
('ALI-016', 'alimentos', 'Figo fresco', 6, NULL, NULL, 'Alimento: Figo fresco
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Amassada com garfo, sem peneirar nem liquidificar
BLW / BLISS (6–8m): Em tiras do tamanho de um dedo adulto; deixar parte da casca para facilitar a pegada quando possível
9–11m (pinça, todas as abordagens): Pedaços pequenos e macios para pegar com a pinça
12m+ (mesa da família): Em pedaços, fatias ou inteira, na mesa com a família
Risco de engasgo: Baixo
Destaque nutricional: Fibras, cálcio
Status: Oferecer'),
('ALI-017', 'alimentos', 'Melancia', 6, NULL, NULL, 'Alimento: Melancia
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Raspada ou amassada, sem sementes
BLW / BLISS (6–8m): Tiras grossas sem sementes (pode deixar a casca como ''cabo'')
9–11m (pinça, todas as abordagens): Cubinhos sem sementes
12m+ (mesa da família): Fatias ou cubos
Risco de engasgo: Baixo
Destaque nutricional: Hidratação
Cuidados / observações: Retirar sementes pretas
Status: Oferecer'),
('ALI-018', 'alimentos', 'Melão', 6, NULL, NULL, 'Alimento: Melão
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Raspada ou amassada, sem sementes
BLW / BLISS (6–8m): Tiras grossas sem sementes (pode deixar a casca como ''cabo'')
9–11m (pinça, todas as abordagens): Cubinhos sem sementes
12m+ (mesa da família): Fatias ou cubos
Risco de engasgo: Baixo
Destaque nutricional: Hidratação, vitamina A
Cuidados / observações: Bem maduro
Status: Oferecer'),
('ALI-019', 'alimentos', 'Abacaxi', 6, NULL, NULL, 'Alimento: Abacaxi
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Raspada ou amassada, sem sementes
BLW / BLISS (6–8m): Tiras grossas sem sementes (pode deixar a casca como ''cabo'')
9–11m (pinça, todas as abordagens): Cubinhos sem sementes
12m+ (mesa da família): Fatias ou cubos
Risco de engasgo: Baixo
Destaque nutricional: Vitamina C
Cuidados / observações: Tiras do miolo são fibrosas; oferecer bem maduro; pode irritar a pele ao redor da boca
Status: Oferecer'),
('ALI-020', 'alimentos', 'Laranja', 6, NULL, NULL, 'Alimento: Laranja
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Gomos sem película e sem sementes, amassados
BLW / BLISS (6–8m): Gomo grande sem sementes para chupar, ou meia-lua com casca
9–11m (pinça, todas as abordagens): Gomos em pedaços pequenos, sem película
12m+ (mesa da família): Gomos inteiros sem sementes
Risco de engasgo: Médio
Destaque nutricional: Vitamina C
Cuidados / observações: Preferir a fruta ao suco
Status: Oferecer'),
('ALI-021', 'alimentos', 'Tangerina / mexerica / ponkan', 6, NULL, NULL, 'Alimento: Tangerina / mexerica / ponkan
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Gomos sem película e sem sementes, amassados
BLW / BLISS (6–8m): Gomo grande sem sementes para chupar, ou meia-lua com casca
9–11m (pinça, todas as abordagens): Gomos em pedaços pequenos, sem película
12m+ (mesa da família): Gomos inteiros sem sementes
Risco de engasgo: Médio
Destaque nutricional: Vitamina C
Status: Oferecer'),
('ALI-022', 'alimentos', 'Uva', 6, NULL, NULL, 'Alimento: Uva
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Sem casca e sem sementes, amassada
BLW / BLISS (6–8m): Cortada em 4 no sentido do comprimento, sem sementes; amassar levemente as muito pequenas
9–11m (pinça, todas as abordagens): Em quartos no comprimento
12m+ (mesa da família): Continuar cortando em quartos até cerca de 4–5 anos
Risco de engasgo: Alto
Destaque nutricional: Antioxidantes
Cuidados / observações: Nunca inteira: um dos maiores riscos de engasgo na infância
Status: Oferecer'),
('ALI-023', 'alimentos', 'Morango', 6, NULL, NULL, 'Alimento: Morango
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Amassada com garfo, sem peneirar nem liquidificar
BLW / BLISS (6–8m): Em tiras do tamanho de um dedo adulto; deixar parte da casca para facilitar a pegada quando possível
9–11m (pinça, todas as abordagens): Pedaços pequenos e macios para pegar com a pinça
12m+ (mesa da família): Em pedaços, fatias ou inteira, na mesa com a família
Risco de engasgo: Baixo
Destaque nutricional: Vitamina C
Cuidados / observações: Grande: inteiro para morder; pequeno: cortado em 4. Vermelhidão local é comum e geralmente não é alergia
Status: Oferecer'),
('ALI-024', 'alimentos', 'Mirtilo (blueberry)', 6, NULL, NULL, 'Alimento: Mirtilo (blueberry)
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Sem casca e sem sementes, amassada
BLW / BLISS (6–8m): Cortada em 4 no sentido do comprimento, sem sementes; amassar levemente as muito pequenas
9–11m (pinça, todas as abordagens): Em quartos no comprimento
12m+ (mesa da família): Continuar cortando em quartos até cerca de 4–5 anos
Risco de engasgo: Alto
Destaque nutricional: Antioxidantes
Cuidados / observações: Amassar entre os dedos antes de oferecer
Status: Oferecer'),
('ALI-025', 'alimentos', 'Framboesa', 6, NULL, NULL, 'Alimento: Framboesa
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Amassada com garfo, sem peneirar nem liquidificar
BLW / BLISS (6–8m): Em tiras do tamanho de um dedo adulto; deixar parte da casca para facilitar a pegada quando possível
9–11m (pinça, todas as abordagens): Pedaços pequenos e macios para pegar com a pinça
12m+ (mesa da família): Em pedaços, fatias ou inteira, na mesa com a família
Risco de engasgo: Baixo
Destaque nutricional: Fibras, vitamina C
Cuidados / observações: Macia; pode ser amassada levemente
Status: Oferecer'),
('ALI-026', 'alimentos', 'Amora', 6, NULL, NULL, 'Alimento: Amora
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Amassada com garfo, sem peneirar nem liquidificar
BLW / BLISS (6–8m): Em tiras do tamanho de um dedo adulto; deixar parte da casca para facilitar a pegada quando possível
9–11m (pinça, todas as abordagens): Pedaços pequenos e macios para pegar com a pinça
12m+ (mesa da família): Em pedaços, fatias ou inteira, na mesa com a família
Risco de engasgo: Baixo
Destaque nutricional: Vitamina C
Cuidados / observações: Amassar levemente
Status: Oferecer'),
('ALI-027', 'alimentos', 'Jabuticaba', 12, NULL, NULL, 'Alimento: Jabuticaba
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 12
Faixa etária: 1a+
Tradicional / papinha (6–8m): Sem casca e sem sementes, amassada
BLW / BLISS (6–8m): Cortada em 4 no sentido do comprimento, sem sementes; amassar levemente as muito pequenas
9–11m (pinça, todas as abordagens): Em quartos no comprimento
12m+ (mesa da família): Continuar cortando em quartos até cerca de 4–5 anos
Risco de engasgo: Alto
Destaque nutricional: Antioxidantes
Cuidados / observações: Oferecer só a polpa sem caroço e sem casca; a fruta inteira é alto risco
Status: Oferecer'),
('ALI-028', 'alimentos', 'Pitanga', 9, NULL, NULL, 'Alimento: Pitanga
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 9
Faixa etária: 9m+
Tradicional / papinha (6–8m): Sem casca e sem sementes, amassada
BLW / BLISS (6–8m): Cortada em 4 no sentido do comprimento, sem sementes; amassar levemente as muito pequenas
9–11m (pinça, todas as abordagens): Em quartos no comprimento
12m+ (mesa da família): Continuar cortando em quartos até cerca de 4–5 anos
Risco de engasgo: Alto
Destaque nutricional: Vitamina A e C
Cuidados / observações: Retirar caroço
Status: Oferecer'),
('ALI-029', 'alimentos', 'Acerola', 6, NULL, NULL, 'Alimento: Acerola
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Sem casca e sem sementes, amassada
BLW / BLISS (6–8m): Cortada em 4 no sentido do comprimento, sem sementes; amassar levemente as muito pequenas
9–11m (pinça, todas as abordagens): Em quartos no comprimento
12m+ (mesa da família): Continuar cortando em quartos até cerca de 4–5 anos
Risco de engasgo: Alto
Destaque nutricional: Vitamina C
Cuidados / observações: Retirar caroços; pode ser amassada
Status: Oferecer'),
('ALI-030', 'alimentos', 'Cereja', 9, NULL, NULL, 'Alimento: Cereja
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 9
Faixa etária: 9m+
Tradicional / papinha (6–8m): Sem casca e sem sementes, amassada
BLW / BLISS (6–8m): Cortada em 4 no sentido do comprimento, sem sementes; amassar levemente as muito pequenas
9–11m (pinça, todas as abordagens): Em quartos no comprimento
12m+ (mesa da família): Continuar cortando em quartos até cerca de 4–5 anos
Risco de engasgo: Alto
Destaque nutricional: Antioxidantes
Cuidados / observações: Sem caroço, em quartos
Status: Oferecer'),
('ALI-031', 'alimentos', 'Carambola', 6, NULL, NULL, 'Alimento: Carambola
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Raspada ou amassada, sem sementes
BLW / BLISS (6–8m): Tiras grossas sem sementes (pode deixar a casca como ''cabo'')
9–11m (pinça, todas as abordagens): Cubinhos sem sementes
12m+ (mesa da família): Fatias ou cubos
Risco de engasgo: Baixo
Destaque nutricional: Vitamina C
Cuidados / observações: Evitar em crianças com doença renal (contém neurotoxina); fatias finas
Status: Oferecer'),
('ALI-032', 'alimentos', 'Maracujá', 12, NULL, NULL, 'Alimento: Maracujá
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 12
Faixa etária: 1a+
Tradicional / papinha (6–8m): Gomos sem película e sem sementes, amassados
BLW / BLISS (6–8m): Gomo grande sem sementes para chupar, ou meia-lua com casca
9–11m (pinça, todas as abordagens): Gomos em pedaços pequenos, sem película
12m+ (mesa da família): Gomos inteiros sem sementes
Risco de engasgo: Médio
Destaque nutricional: Vitamina C
Cuidados / observações: Coar as sementes para menores de 1 ano; usar a polpa em preparações
Status: Oferecer'),
('ALI-033', 'alimentos', 'Graviola', 6, NULL, NULL, 'Alimento: Graviola
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Amassada com garfo, sem peneirar nem liquidificar
BLW / BLISS (6–8m): Em tiras do tamanho de um dedo adulto; deixar parte da casca para facilitar a pegada quando possível
9–11m (pinça, todas as abordagens): Pedaços pequenos e macios para pegar com a pinça
12m+ (mesa da família): Em pedaços, fatias ou inteira, na mesa com a família
Risco de engasgo: Baixo
Destaque nutricional: Vitamina C
Cuidados / observações: Retirar todas as sementes
Status: Oferecer'),
('ALI-034', 'alimentos', 'Fruta-do-conde / pinha', 9, NULL, NULL, 'Alimento: Fruta-do-conde / pinha
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 9
Faixa etária: 9m+
Tradicional / papinha (6–8m): Amassada com garfo, sem peneirar nem liquidificar
BLW / BLISS (6–8m): Em tiras do tamanho de um dedo adulto; deixar parte da casca para facilitar a pegada quando possível
9–11m (pinça, todas as abordagens): Pedaços pequenos e macios para pegar com a pinça
12m+ (mesa da família): Em pedaços, fatias ou inteira, na mesa com a família
Risco de engasgo: Baixo
Destaque nutricional: Energia
Cuidados / observações: Retirar todas as sementes (duras e escorregadias)
Status: Oferecer'),
('ALI-035', 'alimentos', 'Jaca', 9, NULL, NULL, 'Alimento: Jaca
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 9
Faixa etária: 9m+
Tradicional / papinha (6–8m): Amassada com garfo, sem peneirar nem liquidificar
BLW / BLISS (6–8m): Em tiras do tamanho de um dedo adulto; deixar parte da casca para facilitar a pegada quando possível
9–11m (pinça, todas as abordagens): Pedaços pequenos e macios para pegar com a pinça
12m+ (mesa da família): Em pedaços, fatias ou inteira, na mesa com a família
Risco de engasgo: Baixo
Destaque nutricional: Energia
Cuidados / observações: Gomos sem caroço, picados; textura borrachuda
Status: Oferecer'),
('ALI-036', 'alimentos', 'Caju (fruta)', 9, NULL, NULL, 'Alimento: Caju (fruta)
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 9
Faixa etária: 9m+
Tradicional / papinha (6–8m): Amassada com garfo, sem peneirar nem liquidificar
BLW / BLISS (6–8m): Em tiras do tamanho de um dedo adulto; deixar parte da casca para facilitar a pegada quando possível
9–11m (pinça, todas as abordagens): Pedaços pequenos e macios para pegar com a pinça
12m+ (mesa da família): Em pedaços, fatias ou inteira, na mesa com a família
Risco de engasgo: Baixo
Destaque nutricional: Vitamina C
Cuidados / observações: Adstringente; oferecer maduro em tiras
Status: Oferecer'),
('ALI-037', 'alimentos', 'Cupuaçu (polpa)', 6, NULL, NULL, 'Alimento: Cupuaçu (polpa)
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Amassada com garfo, sem peneirar nem liquidificar
BLW / BLISS (6–8m): Em tiras do tamanho de um dedo adulto; deixar parte da casca para facilitar a pegada quando possível
9–11m (pinça, todas as abordagens): Pedaços pequenos e macios para pegar com a pinça
12m+ (mesa da família): Em pedaços, fatias ou inteira, na mesa com a família
Risco de engasgo: Baixo
Destaque nutricional: Vitamina C
Cuidados / observações: Polpa sem açúcar
Status: Oferecer'),
('ALI-038', 'alimentos', 'Açaí (polpa pura)', 6, NULL, NULL, 'Alimento: Açaí (polpa pura)
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Amassada com garfo, sem peneirar nem liquidificar
BLW / BLISS (6–8m): Em tiras do tamanho de um dedo adulto; deixar parte da casca para facilitar a pegada quando possível
9–11m (pinça, todas as abordagens): Pedaços pequenos e macios para pegar com a pinça
12m+ (mesa da família): Em pedaços, fatias ou inteira, na mesa com a família
Risco de engasgo: Baixo
Destaque nutricional: Gorduras boas, antioxidantes
Cuidados / observações: Apenas polpa pura sem xarope/açúcar; misturar com banana
Status: Oferecer'),
('ALI-039', 'alimentos', 'Pitaya', 6, NULL, NULL, 'Alimento: Pitaya
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Amassada com garfo, sem peneirar nem liquidificar
BLW / BLISS (6–8m): Em tiras do tamanho de um dedo adulto; deixar parte da casca para facilitar a pegada quando possível
9–11m (pinça, todas as abordagens): Pedaços pequenos e macios para pegar com a pinça
12m+ (mesa da família): Em pedaços, fatias ou inteira, na mesa com a família
Risco de engasgo: Baixo
Destaque nutricional: Fibras
Status: Oferecer'),
('ALI-040', 'alimentos', 'Lichia', 12, NULL, NULL, 'Alimento: Lichia
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 12
Faixa etária: 1a+
Tradicional / papinha (6–8m): Sem casca e sem sementes, amassada
BLW / BLISS (6–8m): Cortada em 4 no sentido do comprimento, sem sementes; amassar levemente as muito pequenas
9–11m (pinça, todas as abordagens): Em quartos no comprimento
12m+ (mesa da família): Continuar cortando em quartos até cerca de 4–5 anos
Risco de engasgo: Alto
Destaque nutricional: Vitamina C
Cuidados / observações: Alto risco: sem casca e caroço, picada bem miúda
Status: Oferecer'),
('ALI-041', 'alimentos', 'Coco (polpa)', 6, NULL, NULL, 'Alimento: Coco (polpa)
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Raspada com colher ou cozida e amassada
BLW / BLISS (6–8m): Cozida no vapor até amassar entre os dedos, em fatias grossas
9–11m (pinça, todas as abordagens): Cozida em cubinhos ou crua ralada fina
12m+ (mesa da família): Fatias finas cruas; seguir oferecendo com supervisão
Alergênico: Coco (raro)
Risco de engasgo: Alto (crua)
Destaque nutricional: Gorduras
Cuidados / observações: Polpa ralada fina em preparações; pedaços duros são risco
Status: Oferecer'),
('ALI-042', 'alimentos', 'Ameixa seca', 6, NULL, NULL, 'Alimento: Ameixa seca
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Hidratada, sem caroço, amassada ou batida em purê
BLW / BLISS (6–8m): Hidratada, sem caroço, amassada e espalhada em panqueca/torrada
9–11m (pinça, todas as abordagens): Hidratada e picada bem miúda
12m+ (mesa da família): Picada; inteira só quando mastigar bem (idade pré-escolar)
Risco de engasgo: Alto
Destaque nutricional: Fibras (ajuda no intestino)
Status: Oferecer'),
('ALI-043', 'alimentos', 'Uva-passa', 12, NULL, NULL, 'Alimento: Uva-passa
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 12
Faixa etária: 1a+
Tradicional / papinha (6–8m): Hidratada, sem caroço, amassada ou batida em purê
BLW / BLISS (6–8m): Hidratada, sem caroço, amassada e espalhada em panqueca/torrada
9–11m (pinça, todas as abordagens): Hidratada e picada bem miúda
12m+ (mesa da família): Picada; inteira só quando mastigar bem (idade pré-escolar)
Risco de engasgo: Alto
Destaque nutricional: Energia, ferro
Cuidados / observações: Evitar inteira antes de 12m; hidratar e picar
Status: Oferecer'),
('ALI-044', 'alimentos', 'Tâmara', 9, NULL, NULL, 'Alimento: Tâmara
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 9
Faixa etária: 9m+
Tradicional / papinha (6–8m): Hidratada, sem caroço, amassada ou batida em purê
BLW / BLISS (6–8m): Hidratada, sem caroço, amassada e espalhada em panqueca/torrada
9–11m (pinça, todas as abordagens): Hidratada e picada bem miúda
12m+ (mesa da família): Picada; inteira só quando mastigar bem (idade pré-escolar)
Risco de engasgo: Alto
Destaque nutricional: Energia
Cuidados / observações: Sem caroço, picada ou amassada; adoça receitas naturalmente
Status: Oferecer'),
('ALI-045', 'alimentos', 'Damasco seco', 9, NULL, NULL, 'Alimento: Damasco seco
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 9
Faixa etária: 9m+
Tradicional / papinha (6–8m): Hidratada, sem caroço, amassada ou batida em purê
BLW / BLISS (6–8m): Hidratada, sem caroço, amassada e espalhada em panqueca/torrada
9–11m (pinça, todas as abordagens): Hidratada e picada bem miúda
12m+ (mesa da família): Picada; inteira só quando mastigar bem (idade pré-escolar)
Risco de engasgo: Alto
Destaque nutricional: Ferro, vitamina A
Cuidados / observações: Preferir sem sulfito; hidratar e picar
Status: Oferecer'),
('ALI-046', 'alimentos', 'Seriguela', 12, NULL, NULL, 'Alimento: Seriguela
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 12
Faixa etária: 1a+
Tradicional / papinha (6–8m): Sem casca e sem sementes, amassada
BLW / BLISS (6–8m): Cortada em 4 no sentido do comprimento, sem sementes; amassar levemente as muito pequenas
9–11m (pinça, todas as abordagens): Em quartos no comprimento
12m+ (mesa da família): Continuar cortando em quartos até cerca de 4–5 anos
Risco de engasgo: Alto
Destaque nutricional: Vitamina C
Cuidados / observações: Caroço grande: oferecer só a polpa
Status: Oferecer'),
('ALI-047', 'alimentos', 'Mangaba / umbu / cajá', 12, NULL, NULL, 'Alimento: Mangaba / umbu / cajá
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 12
Faixa etária: 1a+
Tradicional / papinha (6–8m): Sem casca e sem sementes, amassada
BLW / BLISS (6–8m): Cortada em 4 no sentido do comprimento, sem sementes; amassar levemente as muito pequenas
9–11m (pinça, todas as abordagens): Em quartos no comprimento
12m+ (mesa da família): Continuar cortando em quartos até cerca de 4–5 anos
Risco de engasgo: Alto
Destaque nutricional: Vitamina C
Cuidados / observações: Frutas regionais: oferecer a polpa sem caroço
Status: Oferecer'),
('ALI-048', 'alimentos', 'Limão', 6, NULL, NULL, 'Alimento: Limão
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Gomos sem película e sem sementes, amassados
BLW / BLISS (6–8m): Gomo grande sem sementes para chupar, ou meia-lua com casca
9–11m (pinça, todas as abordagens): Gomos em pedaços pequenos, sem película
12m+ (mesa da família): Gomos inteiros sem sementes
Risco de engasgo: Médio
Destaque nutricional: Vitamina C
Cuidados / observações: Usar como tempero; deixar o bebê experimentar pequenas quantidades
Status: Oferecer'),
('ALI-049', 'alimentos', 'Abóbora cabotiá', 6, NULL, NULL, 'Alimento: Abóbora cabotiá
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozido e amassado com garfo
BLW / BLISS (6–8m): Cozido no vapor em palitos grossos ou floretes com ''cabinho''; deve amassar entre os dedos
9–11m (pinça, todas as abordagens): Cubinhos cozidos; pode entrar em bolinhos e omeletes
12m+ (mesa da família): Cozido nas preparações da família; cru só ralado
Risco de engasgo: Alto (cru)
Destaque nutricional: Vitamina A
Cuidados / observações: Assada fica doce e macia
Status: Oferecer'),
('ALI-050', 'alimentos', 'Abóbora moranga', 6, NULL, NULL, 'Alimento: Abóbora moranga
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozido e amassado com garfo
BLW / BLISS (6–8m): Cozido no vapor em palitos grossos ou floretes com ''cabinho''; deve amassar entre os dedos
9–11m (pinça, todas as abordagens): Cubinhos cozidos; pode entrar em bolinhos e omeletes
12m+ (mesa da família): Cozido nas preparações da família; cru só ralado
Risco de engasgo: Alto (cru)
Destaque nutricional: Vitamina A
Status: Oferecer'),
('ALI-051', 'alimentos', 'Abobrinha', 6, NULL, NULL, 'Alimento: Abobrinha
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozido e amassado
BLW / BLISS (6–8m): Cozido em tiras ou rodelas grossas, com casca se ajudar na pegada
9–11m (pinça, todas as abordagens): Cubinhos cozidos ou refogados
12m+ (mesa da família): Refogado, assado ou em saladas picadas
Risco de engasgo: Baixo
Destaque nutricional: Hidratação, fibras
Status: Oferecer'),
('ALI-052', 'alimentos', 'Berinjela', 6, NULL, NULL, 'Alimento: Berinjela
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozido e amassado
BLW / BLISS (6–8m): Cozido em tiras ou rodelas grossas, com casca se ajudar na pegada
9–11m (pinça, todas as abordagens): Cubinhos cozidos ou refogados
12m+ (mesa da família): Refogado, assado ou em saladas picadas
Risco de engasgo: Baixo
Destaque nutricional: Fibras
Cuidados / observações: Assada com azeite em tiras com casca
Status: Oferecer'),
('ALI-053', 'alimentos', 'Cenoura', 6, NULL, NULL, 'Alimento: Cenoura
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozido e amassado com garfo
BLW / BLISS (6–8m): Cozido no vapor em palitos grossos ou floretes com ''cabinho''; deve amassar entre os dedos
9–11m (pinça, todas as abordagens): Cubinhos cozidos; pode entrar em bolinhos e omeletes
12m+ (mesa da família): Cozido nas preparações da família; cru só ralado
Risco de engasgo: Alto (cru)
Destaque nutricional: Vitamina A
Cuidados / observações: Crua em palitos ou rodelas é alto risco
Status: Oferecer'),
('ALI-054', 'alimentos', 'Beterraba', 6, NULL, NULL, 'Alimento: Beterraba
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozido e amassado com garfo
BLW / BLISS (6–8m): Cozido no vapor em palitos grossos ou floretes com ''cabinho''; deve amassar entre os dedos
9–11m (pinça, todas as abordagens): Cubinhos cozidos; pode entrar em bolinhos e omeletes
12m+ (mesa da família): Cozido nas preparações da família; cru só ralado
Risco de engasgo: Alto (cru)
Destaque nutricional: Folato
Cuidados / observações: Fezes e urina podem ficar avermelhadas
Status: Oferecer'),
('ALI-055', 'alimentos', 'Chuchu', 6, NULL, NULL, 'Alimento: Chuchu
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozido e amassado
BLW / BLISS (6–8m): Cozido em tiras ou rodelas grossas, com casca se ajudar na pegada
9–11m (pinça, todas as abordagens): Cubinhos cozidos ou refogados
12m+ (mesa da família): Refogado, assado ou em saladas picadas
Risco de engasgo: Baixo
Destaque nutricional: Hidratação
Status: Oferecer'),
('ALI-056', 'alimentos', 'Pepino', 6, NULL, NULL, 'Alimento: Pepino
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozido e amassado
BLW / BLISS (6–8m): Cozido em tiras ou rodelas grossas, com casca se ajudar na pegada
9–11m (pinça, todas as abordagens): Cubinhos cozidos ou refogados
12m+ (mesa da família): Refogado, assado ou em saladas picadas
Risco de engasgo: Baixo
Destaque nutricional: Hidratação
Cuidados / observações: Cru em palitos grossos sem sementes (com casca) ou ralado; conferir se não solta pedaços duros
Status: Oferecer'),
('ALI-057', 'alimentos', 'Tomate', 6, NULL, NULL, 'Alimento: Tomate
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozido e amassado
BLW / BLISS (6–8m): Cozido em tiras ou rodelas grossas, com casca se ajudar na pegada
9–11m (pinça, todas as abordagens): Cubinhos cozidos ou refogados
12m+ (mesa da família): Refogado, assado ou em saladas picadas
Risco de engasgo: Baixo
Destaque nutricional: Vitamina C, licopeno
Cuidados / observações: Maduro, sem pele ou em gomos grandes
Status: Oferecer'),
('ALI-058', 'alimentos', 'Tomate-cereja', 6, NULL, NULL, 'Alimento: Tomate-cereja
Grupo alimentar (Guia MS): Frutas
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Sem casca e sem sementes, amassada
BLW / BLISS (6–8m): Cortada em 4 no sentido do comprimento, sem sementes; amassar levemente as muito pequenas
9–11m (pinça, todas as abordagens): Em quartos no comprimento
12m+ (mesa da família): Continuar cortando em quartos até cerca de 4–5 anos
Risco de engasgo: Alto
Destaque nutricional: Vitamina C
Cuidados / observações: Sempre em quartos
Status: Oferecer'),
('ALI-059', 'alimentos', 'Pimentão vermelho/amarelo', 6, NULL, NULL, 'Alimento: Pimentão vermelho/amarelo
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozido e amassado
BLW / BLISS (6–8m): Cozido em tiras ou rodelas grossas, com casca se ajudar na pegada
9–11m (pinça, todas as abordagens): Cubinhos cozidos ou refogados
12m+ (mesa da família): Refogado, assado ou em saladas picadas
Risco de engasgo: Baixo
Destaque nutricional: Vitamina C
Cuidados / observações: Assado ou refogado; cru em tiras grandes após 9m
Status: Oferecer'),
('ALI-060', 'alimentos', 'Quiabo', 6, NULL, NULL, 'Alimento: Quiabo
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozido e amassado
BLW / BLISS (6–8m): Cozido em tiras ou rodelas grossas, com casca se ajudar na pegada
9–11m (pinça, todas as abordagens): Cubinhos cozidos ou refogados
12m+ (mesa da família): Refogado, assado ou em saladas picadas
Risco de engasgo: Baixo
Destaque nutricional: Fibras, folato
Cuidados / observações: Cozido ou assado inteiro (é macio)
Status: Oferecer'),
('ALI-061', 'alimentos', 'Maxixe', 9, NULL, NULL, 'Alimento: Maxixe
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 9
Faixa etária: 9m+
Tradicional / papinha (6–8m): Cozido e amassado
BLW / BLISS (6–8m): Cozido em tiras ou rodelas grossas, com casca se ajudar na pegada
9–11m (pinça, todas as abordagens): Cubinhos cozidos ou refogados
12m+ (mesa da família): Refogado, assado ou em saladas picadas
Risco de engasgo: Baixo
Destaque nutricional: Fibras
Cuidados / observações: Cozido, picado
Status: Oferecer'),
('ALI-062', 'alimentos', 'Jiló', 9, NULL, NULL, 'Alimento: Jiló
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 9
Faixa etária: 9m+
Tradicional / papinha (6–8m): Cozido e amassado
BLW / BLISS (6–8m): Cozido em tiras ou rodelas grossas, com casca se ajudar na pegada
9–11m (pinça, todas as abordagens): Cubinhos cozidos ou refogados
12m+ (mesa da família): Refogado, assado ou em saladas picadas
Risco de engasgo: Baixo
Destaque nutricional: Fibras
Cuidados / observações: Sabor amargo; oferecer refogado em preparações
Status: Oferecer'),
('ALI-063', 'alimentos', 'Vagem', 6, NULL, NULL, 'Alimento: Vagem
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozido e amassado com garfo
BLW / BLISS (6–8m): Cozido no vapor em palitos grossos ou floretes com ''cabinho''; deve amassar entre os dedos
9–11m (pinça, todas as abordagens): Cubinhos cozidos; pode entrar em bolinhos e omeletes
12m+ (mesa da família): Cozido nas preparações da família; cru só ralado
Risco de engasgo: Alto (cru)
Destaque nutricional: Fibras, folato
Cuidados / observações: Cozida inteira até ficar macia
Status: Oferecer'),
('ALI-064', 'alimentos', 'Ervilha fresca', 6, NULL, NULL, 'Alimento: Ervilha fresca
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozido e amassado
BLW / BLISS (6–8m): Cozido em tiras ou rodelas grossas, com casca se ajudar na pegada
9–11m (pinça, todas as abordagens): Cubinhos cozidos ou refogados
12m+ (mesa da família): Refogado, assado ou em saladas picadas
Risco de engasgo: Baixo
Destaque nutricional: Proteína vegetal, fibras
Cuidados / observações: Amassar levemente para menores de 12m
Status: Oferecer'),
('ALI-065', 'alimentos', 'Brócolis', 6, NULL, NULL, 'Alimento: Brócolis
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozido e amassado com garfo
BLW / BLISS (6–8m): Cozido no vapor em palitos grossos ou floretes com ''cabinho''; deve amassar entre os dedos
9–11m (pinça, todas as abordagens): Cubinhos cozidos; pode entrar em bolinhos e omeletes
12m+ (mesa da família): Cozido nas preparações da família; cru só ralado
Risco de engasgo: Alto (cru)
Destaque nutricional: Vitamina C, cálcio, folato
Cuidados / observações: Floretes com cabinho como ''arvorezinha''
Status: Oferecer'),
('ALI-066', 'alimentos', 'Couve-flor', 6, NULL, NULL, 'Alimento: Couve-flor
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozido e amassado com garfo
BLW / BLISS (6–8m): Cozido no vapor em palitos grossos ou floretes com ''cabinho''; deve amassar entre os dedos
9–11m (pinça, todas as abordagens): Cubinhos cozidos; pode entrar em bolinhos e omeletes
12m+ (mesa da família): Cozido nas preparações da família; cru só ralado
Risco de engasgo: Alto (cru)
Destaque nutricional: Vitamina C
Status: Oferecer'),
('ALI-067', 'alimentos', 'Repolho', 6, NULL, NULL, 'Alimento: Repolho
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Refogada e picada bem fininha, misturada à comida
BLW / BLISS (6–8m): Picada e misturada em bolinhos, omeletes, panquecas; folhas cruas inteiras podem grudar no céu da boca
9–11m (pinça, todas as abordagens): Picada, refogada ou em preparações
12m+ (mesa da família): Salada picadinha ou refogada
Risco de engasgo: Médio
Destaque nutricional: Vitamina C
Cuidados / observações: Refogado bem macio
Status: Oferecer'),
('ALI-068', 'alimentos', 'Couve-de-bruxelas', 9, NULL, NULL, 'Alimento: Couve-de-bruxelas
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 9
Faixa etária: 9m+
Tradicional / papinha (6–8m): Cozido e amassado com garfo
BLW / BLISS (6–8m): Cozido no vapor em palitos grossos ou floretes com ''cabinho''; deve amassar entre os dedos
9–11m (pinça, todas as abordagens): Cubinhos cozidos; pode entrar em bolinhos e omeletes
12m+ (mesa da família): Cozido nas preparações da família; cru só ralado
Risco de engasgo: Alto (cru)
Destaque nutricional: Vitamina C
Cuidados / observações: Cozida macia, em quartos
Status: Oferecer'),
('ALI-069', 'alimentos', 'Couve-manteiga', 6, NULL, NULL, 'Alimento: Couve-manteiga
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Refogada e picada bem fininha, misturada à comida
BLW / BLISS (6–8m): Picada e misturada em bolinhos, omeletes, panquecas; folhas cruas inteiras podem grudar no céu da boca
9–11m (pinça, todas as abordagens): Picada, refogada ou em preparações
12m+ (mesa da família): Salada picadinha ou refogada
Risco de engasgo: Médio
Destaque nutricional: Ferro vegetal, cálcio
Cuidados / observações: Refogada fininha
Status: Oferecer'),
('ALI-070', 'alimentos', 'Espinafre', 6, NULL, NULL, 'Alimento: Espinafre
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Refogada e picada bem fininha, misturada à comida
BLW / BLISS (6–8m): Picada e misturada em bolinhos, omeletes, panquecas; folhas cruas inteiras podem grudar no céu da boca
9–11m (pinça, todas as abordagens): Picada, refogada ou em preparações
12m+ (mesa da família): Salada picadinha ou refogada
Risco de engasgo: Médio
Destaque nutricional: Ferro vegetal, folato
Cuidados / observações: Oferecer junto de vitamina C
Status: Oferecer'),
('ALI-071', 'alimentos', 'Alface', 9, NULL, NULL, 'Alimento: Alface
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 9
Faixa etária: 9m+
Tradicional / papinha (6–8m): Refogada e picada bem fininha, misturada à comida
BLW / BLISS (6–8m): Picada e misturada em bolinhos, omeletes, panquecas; folhas cruas inteiras podem grudar no céu da boca
9–11m (pinça, todas as abordagens): Picada, refogada ou em preparações
12m+ (mesa da família): Salada picadinha ou refogada
Risco de engasgo: Médio
Destaque nutricional: Hidratação
Cuidados / observações: Folha crua picada; inteira pode grudar no palato
Status: Oferecer'),
('ALI-072', 'alimentos', 'Rúcula', 9, NULL, NULL, 'Alimento: Rúcula
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 9
Faixa etária: 9m+
Tradicional / papinha (6–8m): Refogada e picada bem fininha, misturada à comida
BLW / BLISS (6–8m): Picada e misturada em bolinhos, omeletes, panquecas; folhas cruas inteiras podem grudar no céu da boca
9–11m (pinça, todas as abordagens): Picada, refogada ou em preparações
12m+ (mesa da família): Salada picadinha ou refogada
Risco de engasgo: Médio
Destaque nutricional: Cálcio
Cuidados / observações: Sabor forte; misturar
Status: Oferecer'),
('ALI-073', 'alimentos', 'Agrião', 9, NULL, NULL, 'Alimento: Agrião
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 9
Faixa etária: 9m+
Tradicional / papinha (6–8m): Refogada e picada bem fininha, misturada à comida
BLW / BLISS (6–8m): Picada e misturada em bolinhos, omeletes, panquecas; folhas cruas inteiras podem grudar no céu da boca
9–11m (pinça, todas as abordagens): Picada, refogada ou em preparações
12m+ (mesa da família): Salada picadinha ou refogada
Risco de engasgo: Médio
Destaque nutricional: Vitamina C
Status: Oferecer'),
('ALI-074', 'alimentos', 'Acelga', 6, NULL, NULL, 'Alimento: Acelga
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Refogada e picada bem fininha, misturada à comida
BLW / BLISS (6–8m): Picada e misturada em bolinhos, omeletes, panquecas; folhas cruas inteiras podem grudar no céu da boca
9–11m (pinça, todas as abordagens): Picada, refogada ou em preparações
12m+ (mesa da família): Salada picadinha ou refogada
Risco de engasgo: Médio
Destaque nutricional: Vitaminas
Cuidados / observações: Refogada
Status: Oferecer'),
('ALI-075', 'alimentos', 'Escarola', 9, NULL, NULL, 'Alimento: Escarola
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 9
Faixa etária: 9m+
Tradicional / papinha (6–8m): Refogada e picada bem fininha, misturada à comida
BLW / BLISS (6–8m): Picada e misturada em bolinhos, omeletes, panquecas; folhas cruas inteiras podem grudar no céu da boca
9–11m (pinça, todas as abordagens): Picada, refogada ou em preparações
12m+ (mesa da família): Salada picadinha ou refogada
Risco de engasgo: Médio
Destaque nutricional: Folato
Cuidados / observações: Refogada
Status: Oferecer'),
('ALI-076', 'alimentos', 'Ora-pro-nóbis', 6, NULL, NULL, 'Alimento: Ora-pro-nóbis
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Refogada e picada bem fininha, misturada à comida
BLW / BLISS (6–8m): Picada e misturada em bolinhos, omeletes, panquecas; folhas cruas inteiras podem grudar no céu da boca
9–11m (pinça, todas as abordagens): Picada, refogada ou em preparações
12m+ (mesa da família): Salada picadinha ou refogada
Risco de engasgo: Médio
Destaque nutricional: Proteína e ferro vegetal
Cuidados / observações: PANC rica em nutrientes; refogada em preparações
Status: Oferecer'),
('ALI-077', 'alimentos', 'Cebola', 6, NULL, NULL, 'Alimento: Cebola
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozido e amassado
BLW / BLISS (6–8m): Cozido em tiras ou rodelas grossas, com casca se ajudar na pegada
9–11m (pinça, todas as abordagens): Cubinhos cozidos ou refogados
12m+ (mesa da família): Refogado, assado ou em saladas picadas
Risco de engasgo: Baixo
Destaque nutricional: Sabor
Cuidados / observações: Usar refogada como tempero
Status: Oferecer'),
('ALI-078', 'alimentos', 'Alho-poró', 6, NULL, NULL, 'Alimento: Alho-poró
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozido e amassado
BLW / BLISS (6–8m): Cozido em tiras ou rodelas grossas, com casca se ajudar na pegada
9–11m (pinça, todas as abordagens): Cubinhos cozidos ou refogados
12m+ (mesa da família): Refogado, assado ou em saladas picadas
Risco de engasgo: Baixo
Destaque nutricional: Sabor
Cuidados / observações: Refogado
Status: Oferecer'),
('ALI-079', 'alimentos', 'Cogumelo (paris, shiitake)', 6, NULL, NULL, 'Alimento: Cogumelo (paris, shiitake)
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozido e amassado
BLW / BLISS (6–8m): Cozido em tiras ou rodelas grossas, com casca se ajudar na pegada
9–11m (pinça, todas as abordagens): Cubinhos cozidos ou refogados
12m+ (mesa da família): Refogado, assado ou em saladas picadas
Risco de engasgo: Baixo
Destaque nutricional: Vitamina D (quando exposto ao sol), fibras
Cuidados / observações: Sempre cozido; picado ou em tiras grandes
Status: Oferecer'),
('ALI-080', 'alimentos', 'Palmito pupunha fresco', 9, NULL, NULL, 'Alimento: Palmito pupunha fresco
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 9
Faixa etária: 9m+
Tradicional / papinha (6–8m): Cozido e amassado
BLW / BLISS (6–8m): Cozido em tiras ou rodelas grossas, com casca se ajudar na pegada
9–11m (pinça, todas as abordagens): Cubinhos cozidos ou refogados
12m+ (mesa da família): Refogado, assado ou em saladas picadas
Risco de engasgo: Baixo
Destaque nutricional: Fibras
Cuidados / observações: Preferir fresco (o em conserva tem muito sódio)
Status: Oferecer'),
('ALI-081', 'alimentos', 'Aspargo', 6, NULL, NULL, 'Alimento: Aspargo
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozido e amassado com garfo
BLW / BLISS (6–8m): Cozido no vapor em palitos grossos ou floretes com ''cabinho''; deve amassar entre os dedos
9–11m (pinça, todas as abordagens): Cubinhos cozidos; pode entrar em bolinhos e omeletes
12m+ (mesa da família): Cozido nas preparações da família; cru só ralado
Risco de engasgo: Alto (cru)
Destaque nutricional: Folato
Cuidados / observações: Cozido macio, inteiro
Status: Oferecer'),
('ALI-082', 'alimentos', 'Milho verde', 6, NULL, NULL, 'Alimento: Milho verde
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozido e amassado com garfo
BLW / BLISS (6–8m): Cozido no vapor em palitos grossos ou floretes com ''cabinho''; deve amassar entre os dedos
9–11m (pinça, todas as abordagens): Cubinhos cozidos; pode entrar em bolinhos e omeletes
12m+ (mesa da família): Cozido nas preparações da família; cru só ralado
Risco de engasgo: Alto (cru)
Destaque nutricional: Energia, fibras
Cuidados / observações: Espiga cozida para roer (os grãos se soltam); grãos soltos amassados antes de 12m
Status: Oferecer'),
('ALI-083', 'alimentos', 'Rabanete', 12, NULL, NULL, 'Alimento: Rabanete
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 12
Faixa etária: 1a+
Tradicional / papinha (6–8m): Cozido e amassado com garfo
BLW / BLISS (6–8m): Cozido no vapor em palitos grossos ou floretes com ''cabinho''; deve amassar entre os dedos
9–11m (pinça, todas as abordagens): Cubinhos cozidos; pode entrar em bolinhos e omeletes
12m+ (mesa da família): Cozido nas preparações da família; cru só ralado
Risco de engasgo: Alto (cru)
Destaque nutricional: Vitamina C
Cuidados / observações: Cozido ou ralado
Status: Oferecer'),
('ALI-084', 'alimentos', 'Nabo', 6, NULL, NULL, 'Alimento: Nabo
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozido e amassado com garfo
BLW / BLISS (6–8m): Cozido no vapor em palitos grossos ou floretes com ''cabinho''; deve amassar entre os dedos
9–11m (pinça, todas as abordagens): Cubinhos cozidos; pode entrar em bolinhos e omeletes
12m+ (mesa da família): Cozido nas preparações da família; cru só ralado
Risco de engasgo: Alto (cru)
Destaque nutricional: Vitamina C
Cuidados / observações: Cozido
Status: Oferecer'),
('ALI-085', 'alimentos', 'Salsão / aipo', 12, NULL, NULL, 'Alimento: Salsão / aipo
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 12
Faixa etária: 1a+
Tradicional / papinha (6–8m): Refogada e picada bem fininha, misturada à comida
BLW / BLISS (6–8m): Picada e misturada em bolinhos, omeletes, panquecas; folhas cruas inteiras podem grudar no céu da boca
9–11m (pinça, todas as abordagens): Picada, refogada ou em preparações
12m+ (mesa da família): Salada picadinha ou refogada
Risco de engasgo: Médio
Destaque nutricional: Fibras
Cuidados / observações: Fibroso; usar picado em refogados
Status: Oferecer'),
('ALI-086', 'alimentos', 'Erva-doce (bulbo)', 9, NULL, NULL, 'Alimento: Erva-doce (bulbo)
Grupo alimentar (Guia MS): Legumes e verduras
Idade mín. (meses): 9
Faixa etária: 9m+
Tradicional / papinha (6–8m): Cozido e amassado
BLW / BLISS (6–8m): Cozido em tiras ou rodelas grossas, com casca se ajudar na pegada
9–11m (pinça, todas as abordagens): Cubinhos cozidos ou refogados
12m+ (mesa da família): Refogado, assado ou em saladas picadas
Risco de engasgo: Baixo
Destaque nutricional: Sabor
Cuidados / observações: Cozido ou assado
Status: Oferecer'),
('ALI-087', 'alimentos', 'Batata inglesa', 6, NULL, NULL, 'Alimento: Batata inglesa
Grupo alimentar (Guia MS): Raízes e tubérculos
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozido e amassado com garfo (sem liquidificar)
BLW / BLISS (6–8m): Palitos grossos cozidos ou assados até ficarem macios; também em bolinhos
9–11m (pinça, todas as abordagens): Cubinhos ou amassado grosso
12m+ (mesa da família): Cozido, assado ou em purês e sopas da família
Risco de engasgo: Baixo
Destaque nutricional: Energia
Status: Oferecer'),
('ALI-088', 'alimentos', 'Batata-doce laranja', 6, NULL, NULL, 'Alimento: Batata-doce laranja
Grupo alimentar (Guia MS): Raízes e tubérculos
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozido e amassado com garfo (sem liquidificar)
BLW / BLISS (6–8m): Palitos grossos cozidos ou assados até ficarem macios; também em bolinhos
9–11m (pinça, todas as abordagens): Cubinhos ou amassado grosso
12m+ (mesa da família): Cozido, assado ou em purês e sopas da família
Risco de engasgo: Baixo
Destaque nutricional: Energia, vitamina A
Cuidados / observações: Palitos assados são ótimos para BLW
Status: Oferecer'),
('ALI-089', 'alimentos', 'Batata-doce roxa', 6, NULL, NULL, 'Alimento: Batata-doce roxa
Grupo alimentar (Guia MS): Raízes e tubérculos
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozido e amassado com garfo (sem liquidificar)
BLW / BLISS (6–8m): Palitos grossos cozidos ou assados até ficarem macios; também em bolinhos
9–11m (pinça, todas as abordagens): Cubinhos ou amassado grosso
12m+ (mesa da família): Cozido, assado ou em purês e sopas da família
Risco de engasgo: Baixo
Destaque nutricional: Energia, antioxidantes
Status: Oferecer'),
('ALI-090', 'alimentos', 'Mandioca / aipim / macaxeira', 6, NULL, NULL, 'Alimento: Mandioca / aipim / macaxeira
Grupo alimentar (Guia MS): Raízes e tubérculos
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozido e amassado com garfo (sem liquidificar)
BLW / BLISS (6–8m): Palitos grossos cozidos ou assados até ficarem macios; também em bolinhos
9–11m (pinça, todas as abordagens): Cubinhos ou amassado grosso
12m+ (mesa da família): Cozido, assado ou em purês e sopas da família
Risco de engasgo: Baixo
Destaque nutricional: Energia
Cuidados / observações: Sempre bem cozida; retirar a fibra central
Status: Oferecer'),
('ALI-091', 'alimentos', 'Mandioquinha / batata-baroa', 6, NULL, NULL, 'Alimento: Mandioquinha / batata-baroa
Grupo alimentar (Guia MS): Raízes e tubérculos
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozido e amassado com garfo (sem liquidificar)
BLW / BLISS (6–8m): Palitos grossos cozidos ou assados até ficarem macios; também em bolinhos
9–11m (pinça, todas as abordagens): Cubinhos ou amassado grosso
12m+ (mesa da família): Cozido, assado ou em purês e sopas da família
Risco de engasgo: Baixo
Destaque nutricional: Energia
Status: Oferecer'),
('ALI-092', 'alimentos', 'Inhame', 6, NULL, NULL, 'Alimento: Inhame
Grupo alimentar (Guia MS): Raízes e tubérculos
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozido e amassado com garfo (sem liquidificar)
BLW / BLISS (6–8m): Palitos grossos cozidos ou assados até ficarem macios; também em bolinhos
9–11m (pinça, todas as abordagens): Cubinhos ou amassado grosso
12m+ (mesa da família): Cozido, assado ou em purês e sopas da família
Risco de engasgo: Baixo
Destaque nutricional: Energia
Status: Oferecer'),
('ALI-093', 'alimentos', 'Cará', 6, NULL, NULL, 'Alimento: Cará
Grupo alimentar (Guia MS): Raízes e tubérculos
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozido e amassado com garfo (sem liquidificar)
BLW / BLISS (6–8m): Palitos grossos cozidos ou assados até ficarem macios; também em bolinhos
9–11m (pinça, todas as abordagens): Cubinhos ou amassado grosso
12m+ (mesa da família): Cozido, assado ou em purês e sopas da família
Risco de engasgo: Baixo
Destaque nutricional: Energia
Status: Oferecer'),
('ALI-094', 'alimentos', 'Arroz branco', 6, NULL, NULL, 'Alimento: Arroz branco
Grupo alimentar (Guia MS): Cereais
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Bem cozido, soltinho ou em papa grossa
BLW / BLISS (6–8m): Em bolinhos, panquecas ou formatos fáceis de pegar
9–11m (pinça, todas as abordagens): Soltinho, com pedaços; a criança pega com os dedos ou colher
12m+ (mesa da família): Como na mesa da família
Risco de engasgo: Baixo
Destaque nutricional: Energia
Cuidados / observações: Bolinhos de arroz facilitam a pegada no BLW
Status: Oferecer'),
('ALI-095', 'alimentos', 'Arroz integral', 6, NULL, NULL, 'Alimento: Arroz integral
Grupo alimentar (Guia MS): Cereais
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Bem cozido, soltinho ou em papa grossa
BLW / BLISS (6–8m): Em bolinhos, panquecas ou formatos fáceis de pegar
9–11m (pinça, todas as abordagens): Soltinho, com pedaços; a criança pega com os dedos ou colher
12m+ (mesa da família): Como na mesa da família
Risco de engasgo: Baixo
Destaque nutricional: Energia, fibras
Cuidados / observações: Bem cozido
Status: Oferecer'),
('ALI-096', 'alimentos', 'Arroz vermelho / negro', 9, NULL, NULL, 'Alimento: Arroz vermelho / negro
Grupo alimentar (Guia MS): Cereais
Idade mín. (meses): 9
Faixa etária: 9m+
Tradicional / papinha (6–8m): Bem cozido, soltinho ou em papa grossa
BLW / BLISS (6–8m): Em bolinhos, panquecas ou formatos fáceis de pegar
9–11m (pinça, todas as abordagens): Soltinho, com pedaços; a criança pega com os dedos ou colher
12m+ (mesa da família): Como na mesa da família
Risco de engasgo: Baixo
Destaque nutricional: Fibras
Status: Oferecer'),
('ALI-097', 'alimentos', 'Aveia em flocos', 6, NULL, NULL, 'Alimento: Aveia em flocos
Grupo alimentar (Guia MS): Cereais
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Bem cozido, soltinho ou em papa grossa
BLW / BLISS (6–8m): Em bolinhos, panquecas ou formatos fáceis de pegar
9–11m (pinça, todas as abordagens): Soltinho, com pedaços; a criança pega com os dedos ou colher
12m+ (mesa da família): Como na mesa da família
Alergênico: Pode ter contaminação com glúten
Risco de engasgo: Baixo
Destaque nutricional: Fibras, ferro
Cuidados / observações: Mingau com fruta, panquecas
Status: Oferecer'),
('ALI-098', 'alimentos', 'Quinoa', 6, NULL, NULL, 'Alimento: Quinoa
Grupo alimentar (Guia MS): Cereais
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Bem cozido, soltinho ou em papa grossa
BLW / BLISS (6–8m): Em bolinhos, panquecas ou formatos fáceis de pegar
9–11m (pinça, todas as abordagens): Soltinho, com pedaços; a criança pega com os dedos ou colher
12m+ (mesa da família): Como na mesa da família
Risco de engasgo: Baixo
Destaque nutricional: Proteína, ferro
Cuidados / observações: Lavar bem antes de cozinhar
Status: Oferecer'),
('ALI-099', 'alimentos', 'Amaranto', 6, NULL, NULL, 'Alimento: Amaranto
Grupo alimentar (Guia MS): Cereais
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Bem cozido, soltinho ou em papa grossa
BLW / BLISS (6–8m): Em bolinhos, panquecas ou formatos fáceis de pegar
9–11m (pinça, todas as abordagens): Soltinho, com pedaços; a criança pega com os dedos ou colher
12m+ (mesa da família): Como na mesa da família
Risco de engasgo: Baixo
Destaque nutricional: Ferro, cálcio
Cuidados / observações: Em flocos ou cozido
Status: Oferecer'),
('ALI-100', 'alimentos', 'Fubá / polenta', 6, NULL, NULL, 'Alimento: Fubá / polenta
Grupo alimentar (Guia MS): Cereais
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Bem cozido, soltinho ou em papa grossa
BLW / BLISS (6–8m): Em bolinhos, panquecas ou formatos fáceis de pegar
9–11m (pinça, todas as abordagens): Soltinho, com pedaços; a criança pega com os dedos ou colher
12m+ (mesa da família): Como na mesa da família
Risco de engasgo: Baixo
Destaque nutricional: Energia
Cuidados / observações: Polenta firme em palitos é ótima para BLW
Status: Oferecer'),
('ALI-101', 'alimentos', 'Cuscuz nordestino (flocão)', 6, NULL, NULL, 'Alimento: Cuscuz nordestino (flocão)
Grupo alimentar (Guia MS): Cereais
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Bem cozido, soltinho ou em papa grossa
BLW / BLISS (6–8m): Em bolinhos, panquecas ou formatos fáceis de pegar
9–11m (pinça, todas as abordagens): Soltinho, com pedaços; a criança pega com os dedos ou colher
12m+ (mesa da família): Como na mesa da família
Risco de engasgo: Baixo
Destaque nutricional: Energia
Cuidados / observações: Úmido, sem sal
Status: Oferecer'),
('ALI-102', 'alimentos', 'Cuscuz marroquino', 9, NULL, NULL, 'Alimento: Cuscuz marroquino
Grupo alimentar (Guia MS): Cereais
Idade mín. (meses): 9
Faixa etária: 9m+
Tradicional / papinha (6–8m): Bem cozido, soltinho ou em papa grossa
BLW / BLISS (6–8m): Em bolinhos, panquecas ou formatos fáceis de pegar
9–11m (pinça, todas as abordagens): Soltinho, com pedaços; a criança pega com os dedos ou colher
12m+ (mesa da família): Como na mesa da família
Alergênico: Trigo (glúten)
Risco de engasgo: Baixo
Destaque nutricional: Energia
Status: Oferecer'),
('ALI-103', 'alimentos', 'Macarrão de trigo', 6, NULL, NULL, 'Alimento: Macarrão de trigo
Grupo alimentar (Guia MS): Cereais
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Bem cozido, soltinho ou em papa grossa
BLW / BLISS (6–8m): Em bolinhos, panquecas ou formatos fáceis de pegar
9–11m (pinça, todas as abordagens): Soltinho, com pedaços; a criança pega com os dedos ou colher
12m+ (mesa da família): Como na mesa da família
Alergênico: Trigo (glúten)
Risco de engasgo: Baixo
Destaque nutricional: Energia
Cuidados / observações: Formatos grandes (parafuso, penne) bem cozidos para BLW
Status: Oferecer'),
('ALI-104', 'alimentos', 'Macarrão integral', 6, NULL, NULL, 'Alimento: Macarrão integral
Grupo alimentar (Guia MS): Cereais
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Bem cozido, soltinho ou em papa grossa
BLW / BLISS (6–8m): Em bolinhos, panquecas ou formatos fáceis de pegar
9–11m (pinça, todas as abordagens): Soltinho, com pedaços; a criança pega com os dedos ou colher
12m+ (mesa da família): Como na mesa da família
Alergênico: Trigo (glúten)
Risco de engasgo: Baixo
Destaque nutricional: Fibras
Status: Oferecer'),
('ALI-105', 'alimentos', 'Pão caseiro sem sal', 6, NULL, NULL, 'Alimento: Pão caseiro sem sal
Grupo alimentar (Guia MS): Cereais
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Bem cozido, soltinho ou em papa grossa
BLW / BLISS (6–8m): Em bolinhos, panquecas ou formatos fáceis de pegar
9–11m (pinça, todas as abordagens): Soltinho, com pedaços; a criança pega com os dedos ou colher
12m+ (mesa da família): Como na mesa da família
Alergênico: Trigo (glúten)
Risco de engasgo: Baixo
Destaque nutricional: Energia
Cuidados / observações: Pães industrializados têm sódio e às vezes açúcar; torrada em tiras é mais segura que miolo (que embola)
Status: Oferecer'),
('ALI-106', 'alimentos', 'Tapioca (goma)', 9, NULL, NULL, 'Alimento: Tapioca (goma)
Grupo alimentar (Guia MS): Cereais
Idade mín. (meses): 9
Faixa etária: 9m+
Tradicional / papinha (6–8m): Bem cozido, soltinho ou em papa grossa
BLW / BLISS (6–8m): Em bolinhos, panquecas ou formatos fáceis de pegar
9–11m (pinça, todas as abordagens): Soltinho, com pedaços; a criança pega com os dedos ou colher
12m+ (mesa da família): Como na mesa da família
Risco de engasgo: Baixo
Destaque nutricional: Energia
Cuidados / observações: Pode grudar; preferir fina e com recheio úmido
Status: Oferecer'),
('ALI-107', 'alimentos', 'Farinha de mandioca', 9, NULL, NULL, 'Alimento: Farinha de mandioca
Grupo alimentar (Guia MS): Cereais
Idade mín. (meses): 9
Faixa etária: 9m+
Tradicional / papinha (6–8m): Bem cozido, soltinho ou em papa grossa
BLW / BLISS (6–8m): Em bolinhos, panquecas ou formatos fáceis de pegar
9–11m (pinça, todas as abordagens): Soltinho, com pedaços; a criança pega com os dedos ou colher
12m+ (mesa da família): Como na mesa da família
Risco de engasgo: Baixo
Destaque nutricional: Energia
Cuidados / observações: Evitar farofa seca e torrada (risco de aspiração); usar em pirão úmido
Status: Oferecer'),
('ALI-108', 'alimentos', 'Cevadinha', 9, NULL, NULL, 'Alimento: Cevadinha
Grupo alimentar (Guia MS): Cereais
Idade mín. (meses): 9
Faixa etária: 9m+
Tradicional / papinha (6–8m): Bem cozido, soltinho ou em papa grossa
BLW / BLISS (6–8m): Em bolinhos, panquecas ou formatos fáceis de pegar
9–11m (pinça, todas as abordagens): Soltinho, com pedaços; a criança pega com os dedos ou colher
12m+ (mesa da família): Como na mesa da família
Alergênico: Glúten
Risco de engasgo: Baixo
Destaque nutricional: Fibras
Cuidados / observações: Em sopas
Status: Oferecer'),
('ALI-109', 'alimentos', 'Trigo sarraceno', 9, NULL, NULL, 'Alimento: Trigo sarraceno
Grupo alimentar (Guia MS): Cereais
Idade mín. (meses): 9
Faixa etária: 9m+
Tradicional / papinha (6–8m): Bem cozido, soltinho ou em papa grossa
BLW / BLISS (6–8m): Em bolinhos, panquecas ou formatos fáceis de pegar
9–11m (pinça, todas as abordagens): Soltinho, com pedaços; a criança pega com os dedos ou colher
12m+ (mesa da família): Como na mesa da família
Risco de engasgo: Baixo
Destaque nutricional: Proteína, ferro
Cuidados / observações: Apesar do nome, não contém glúten
Status: Oferecer'),
('ALI-110', 'alimentos', 'Milho de pipoca', 48, NULL, NULL, 'Alimento: Milho de pipoca
Grupo alimentar (Guia MS): Cereais
Idade mín. (meses): 48
Faixa etária: 4a+
Tradicional / papinha (6–8m): Bem cozido, soltinho ou em papa grossa
BLW / BLISS (6–8m): Em bolinhos, panquecas ou formatos fáceis de pegar
9–11m (pinça, todas as abordagens): Soltinho, com pedaços; a criança pega com os dedos ou colher
12m+ (mesa da família): Como na mesa da família
Risco de engasgo: Baixo
Cuidados / observações: Pipoca é um dos maiores riscos de engasgo: evitar antes dos 4 anos
Status: Oferecer'),
('ALI-111', 'alimentos', 'Feijão carioca', 6, NULL, NULL, 'Alimento: Feijão carioca
Grupo alimentar (Guia MS): Feijões
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Grãos cozidos amassados com o caldo (oferecer os grãos, não apenas o caldo)
BLW / BLISS (6–8m): Amassados em bolinhos/hambúrgueres ou em pasta espalhada em torrada
9–11m (pinça, todas as abordagens): Grãos bem cozidos levemente amassados
12m+ (mesa da família): Grãos inteiros bem cozidos
Risco de engasgo: Médio
Destaque nutricional: Ferro, proteína, fibras
Cuidados / observações: Deixar de molho e descartar a água ajuda na digestão
Status: Oferecer'),
('ALI-112', 'alimentos', 'Feijão preto', 6, NULL, NULL, 'Alimento: Feijão preto
Grupo alimentar (Guia MS): Feijões
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Grãos cozidos amassados com o caldo (oferecer os grãos, não apenas o caldo)
BLW / BLISS (6–8m): Amassados em bolinhos/hambúrgueres ou em pasta espalhada em torrada
9–11m (pinça, todas as abordagens): Grãos bem cozidos levemente amassados
12m+ (mesa da família): Grãos inteiros bem cozidos
Risco de engasgo: Médio
Destaque nutricional: Ferro, proteína
Status: Oferecer'),
('ALI-113', 'alimentos', 'Feijão branco', 6, NULL, NULL, 'Alimento: Feijão branco
Grupo alimentar (Guia MS): Feijões
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Grãos cozidos amassados com o caldo (oferecer os grãos, não apenas o caldo)
BLW / BLISS (6–8m): Amassados em bolinhos/hambúrgueres ou em pasta espalhada em torrada
9–11m (pinça, todas as abordagens): Grãos bem cozidos levemente amassados
12m+ (mesa da família): Grãos inteiros bem cozidos
Risco de engasgo: Médio
Destaque nutricional: Ferro, proteína
Status: Oferecer'),
('ALI-114', 'alimentos', 'Feijão fradinho', 6, NULL, NULL, 'Alimento: Feijão fradinho
Grupo alimentar (Guia MS): Feijões
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Grãos cozidos amassados com o caldo (oferecer os grãos, não apenas o caldo)
BLW / BLISS (6–8m): Amassados em bolinhos/hambúrgueres ou em pasta espalhada em torrada
9–11m (pinça, todas as abordagens): Grãos bem cozidos levemente amassados
12m+ (mesa da família): Grãos inteiros bem cozidos
Risco de engasgo: Médio
Destaque nutricional: Proteína
Status: Oferecer'),
('ALI-115', 'alimentos', 'Feijão azuki', 6, NULL, NULL, 'Alimento: Feijão azuki
Grupo alimentar (Guia MS): Feijões
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Grãos cozidos amassados com o caldo (oferecer os grãos, não apenas o caldo)
BLW / BLISS (6–8m): Amassados em bolinhos/hambúrgueres ou em pasta espalhada em torrada
9–11m (pinça, todas as abordagens): Grãos bem cozidos levemente amassados
12m+ (mesa da família): Grãos inteiros bem cozidos
Risco de engasgo: Médio
Destaque nutricional: Proteína, ferro
Status: Oferecer'),
('ALI-116', 'alimentos', 'Lentilha', 6, NULL, NULL, 'Alimento: Lentilha
Grupo alimentar (Guia MS): Feijões
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Grãos cozidos amassados com o caldo (oferecer os grãos, não apenas o caldo)
BLW / BLISS (6–8m): Amassados em bolinhos/hambúrgueres ou em pasta espalhada em torrada
9–11m (pinça, todas as abordagens): Grãos bem cozidos levemente amassados
12m+ (mesa da família): Grãos inteiros bem cozidos
Risco de engasgo: Médio
Destaque nutricional: Ferro, proteína
Cuidados / observações: Cozinha rápido e amassa fácil
Status: Oferecer'),
('ALI-117', 'alimentos', 'Grão-de-bico', 6, NULL, NULL, 'Alimento: Grão-de-bico
Grupo alimentar (Guia MS): Feijões
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Grãos cozidos amassados com o caldo (oferecer os grãos, não apenas o caldo)
BLW / BLISS (6–8m): Amassados em bolinhos/hambúrgueres ou em pasta espalhada em torrada
9–11m (pinça, todas as abordagens): Grãos bem cozidos levemente amassados
12m+ (mesa da família): Grãos inteiros bem cozidos
Risco de engasgo: Médio
Destaque nutricional: Proteína, ferro
Cuidados / observações: Inteiro é risco: amassar ou transformar em homus
Status: Oferecer'),
('ALI-118', 'alimentos', 'Ervilha seca', 6, NULL, NULL, 'Alimento: Ervilha seca
Grupo alimentar (Guia MS): Feijões
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Grãos cozidos amassados com o caldo (oferecer os grãos, não apenas o caldo)
BLW / BLISS (6–8m): Amassados em bolinhos/hambúrgueres ou em pasta espalhada em torrada
9–11m (pinça, todas as abordagens): Grãos bem cozidos levemente amassados
12m+ (mesa da família): Grãos inteiros bem cozidos
Risco de engasgo: Médio
Destaque nutricional: Proteína
Status: Oferecer'),
('ALI-119', 'alimentos', 'Soja / edamame', 9, NULL, NULL, 'Alimento: Soja / edamame
Grupo alimentar (Guia MS): Feijões
Idade mín. (meses): 9
Faixa etária: 9m+
Tradicional / papinha (6–8m): Grãos cozidos amassados com o caldo (oferecer os grãos, não apenas o caldo)
BLW / BLISS (6–8m): Amassados em bolinhos/hambúrgueres ou em pasta espalhada em torrada
9–11m (pinça, todas as abordagens): Grãos bem cozidos levemente amassados
12m+ (mesa da família): Grãos inteiros bem cozidos
Alergênico: Soja
Risco de engasgo: Médio
Destaque nutricional: Proteína
Cuidados / observações: Edamame sem casca amassado
Status: Oferecer'),
('ALI-120', 'alimentos', 'Tofu', 6, NULL, NULL, 'Alimento: Tofu
Grupo alimentar (Guia MS): Feijões
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Grãos cozidos amassados com o caldo (oferecer os grãos, não apenas o caldo)
BLW / BLISS (6–8m): Amassados em bolinhos/hambúrgueres ou em pasta espalhada em torrada
9–11m (pinça, todas as abordagens): Grãos bem cozidos levemente amassados
12m+ (mesa da família): Grãos inteiros bem cozidos
Alergênico: Soja
Risco de engasgo: Médio
Destaque nutricional: Proteína, cálcio
Cuidados / observações: Firme em tiras, grelhado
Status: Oferecer'),
('ALI-121', 'alimentos', 'Carne bovina – acém / músculo', 6, NULL, NULL, 'Alimento: Carne bovina – acém / músculo
Grupo alimentar (Guia MS): Carnes e ovos
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozida e desfiada ou picada bem miúda (não liquidificar)
BLW / BLISS (6–8m): Tiras grandes e macias para chupar e mastigar; ou moída em bolinhos
9–11m (pinça, todas as abordagens): Desfiada ou em pedaços pequenos e macios
12m+ (mesa da família): Pedaços macios; seguir com carnes suculentas
Risco de engasgo: Médio
Destaque nutricional: Ferro heme, zinco, proteína
Cuidados / observações: Cozida lentamente até desmanchar
Status: Oferecer'),
('ALI-122', 'alimentos', 'Carne bovina moída (patinho)', 6, NULL, NULL, 'Alimento: Carne bovina moída (patinho)
Grupo alimentar (Guia MS): Carnes e ovos
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozida e desfiada ou picada bem miúda (não liquidificar)
BLW / BLISS (6–8m): Tiras grandes e macias para chupar e mastigar; ou moída em bolinhos
9–11m (pinça, todas as abordagens): Desfiada ou em pedaços pequenos e macios
12m+ (mesa da família): Pedaços macios; seguir com carnes suculentas
Risco de engasgo: Médio
Destaque nutricional: Ferro heme, zinco
Cuidados / observações: Bolinhos e almôndegas
Status: Oferecer'),
('ALI-123', 'alimentos', 'Fígado bovino', 6, NULL, NULL, 'Alimento: Fígado bovino
Grupo alimentar (Guia MS): Carnes e ovos
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozida e desfiada ou picada bem miúda (não liquidificar)
BLW / BLISS (6–8m): Tiras grandes e macias para chupar e mastigar; ou moída em bolinhos
9–11m (pinça, todas as abordagens): Desfiada ou em pedaços pequenos e macios
12m+ (mesa da família): Pedaços macios; seguir com carnes suculentas
Risco de engasgo: Médio
Destaque nutricional: Ferro, vitamina A
Cuidados / observações: Até 1 vez por semana, em pequena quantidade (excesso de vitamina A)
Status: Oferecer'),
('ALI-124', 'alimentos', 'Frango – peito', 6, NULL, NULL, 'Alimento: Frango – peito
Grupo alimentar (Guia MS): Carnes e ovos
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozida e desfiada ou picada bem miúda (não liquidificar)
BLW / BLISS (6–8m): Tiras grandes e macias para chupar e mastigar; ou moída em bolinhos
9–11m (pinça, todas as abordagens): Desfiada ou em pedaços pequenos e macios
12m+ (mesa da família): Pedaços macios; seguir com carnes suculentas
Risco de engasgo: Médio
Destaque nutricional: Proteína
Cuidados / observações: Tende a ficar seco: preferir desfiado com caldo
Status: Oferecer'),
('ALI-125', 'alimentos', 'Frango – coxa/sobrecoxa', 6, NULL, NULL, 'Alimento: Frango – coxa/sobrecoxa
Grupo alimentar (Guia MS): Carnes e ovos
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozida e desfiada ou picada bem miúda (não liquidificar)
BLW / BLISS (6–8m): Tiras grandes e macias para chupar e mastigar; ou moída em bolinhos
9–11m (pinça, todas as abordagens): Desfiada ou em pedaços pequenos e macios
12m+ (mesa da família): Pedaços macios; seguir com carnes suculentas
Risco de engasgo: Médio
Destaque nutricional: Proteína, ferro
Cuidados / observações: Coxa sem pele e sem ossos pequenos para segurar pelo osso grande
Status: Oferecer'),
('ALI-126', 'alimentos', 'Fígado de frango', 6, NULL, NULL, 'Alimento: Fígado de frango
Grupo alimentar (Guia MS): Carnes e ovos
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozida e desfiada ou picada bem miúda (não liquidificar)
BLW / BLISS (6–8m): Tiras grandes e macias para chupar e mastigar; ou moída em bolinhos
9–11m (pinça, todas as abordagens): Desfiada ou em pedaços pequenos e macios
12m+ (mesa da família): Pedaços macios; seguir com carnes suculentas
Risco de engasgo: Médio
Destaque nutricional: Ferro, vitamina A
Cuidados / observações: Até 1 vez por semana
Status: Oferecer'),
('ALI-127', 'alimentos', 'Coração de frango', 9, NULL, NULL, 'Alimento: Coração de frango
Grupo alimentar (Guia MS): Carnes e ovos
Idade mín. (meses): 9
Faixa etária: 9m+
Tradicional / papinha (6–8m): Cozida e desfiada ou picada bem miúda (não liquidificar)
BLW / BLISS (6–8m): Tiras grandes e macias para chupar e mastigar; ou moída em bolinhos
9–11m (pinça, todas as abordagens): Desfiada ou em pedaços pequenos e macios
12m+ (mesa da família): Pedaços macios; seguir com carnes suculentas
Risco de engasgo: Médio
Destaque nutricional: Ferro
Cuidados / observações: Cozido e picado (textura firme)
Status: Oferecer'),
('ALI-128', 'alimentos', 'Carne suína – lombo / pernil', 6, NULL, NULL, 'Alimento: Carne suína – lombo / pernil
Grupo alimentar (Guia MS): Carnes e ovos
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozida e desfiada ou picada bem miúda (não liquidificar)
BLW / BLISS (6–8m): Tiras grandes e macias para chupar e mastigar; ou moída em bolinhos
9–11m (pinça, todas as abordagens): Desfiada ou em pedaços pequenos e macios
12m+ (mesa da família): Pedaços macios; seguir com carnes suculentas
Risco de engasgo: Médio
Destaque nutricional: Proteína, ferro
Cuidados / observações: Bem cozida
Status: Oferecer'),
('ALI-129', 'alimentos', 'Cordeiro', 6, NULL, NULL, 'Alimento: Cordeiro
Grupo alimentar (Guia MS): Carnes e ovos
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozida e desfiada ou picada bem miúda (não liquidificar)
BLW / BLISS (6–8m): Tiras grandes e macias para chupar e mastigar; ou moída em bolinhos
9–11m (pinça, todas as abordagens): Desfiada ou em pedaços pequenos e macios
12m+ (mesa da família): Pedaços macios; seguir com carnes suculentas
Risco de engasgo: Médio
Destaque nutricional: Ferro, zinco
Status: Oferecer'),
('ALI-130', 'alimentos', 'Peru', 6, NULL, NULL, 'Alimento: Peru
Grupo alimentar (Guia MS): Carnes e ovos
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozida e desfiada ou picada bem miúda (não liquidificar)
BLW / BLISS (6–8m): Tiras grandes e macias para chupar e mastigar; ou moída em bolinhos
9–11m (pinça, todas as abordagens): Desfiada ou em pedaços pequenos e macios
12m+ (mesa da família): Pedaços macios; seguir com carnes suculentas
Risco de engasgo: Médio
Destaque nutricional: Proteína
Cuidados / observações: Evitar peito de peru processado (embutido)
Status: Oferecer'),
('ALI-131', 'alimentos', 'Peixe branco (tilápia, pescada, merluza)', 6, NULL, NULL, 'Alimento: Peixe branco (tilápia, pescada, merluza)
Grupo alimentar (Guia MS): Carnes e ovos
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozido e desfiado, sem espinhas, misturado à comida
BLW / BLISS (6–8m): Lascas grandes sem espinhas; bolinhos de peixe
9–11m (pinça, todas as abordagens): Lascas pequenas
12m+ (mesa da família): Como na mesa da família, sempre sem espinhas
Alergênico: Peixe
Risco de engasgo: Médio
Destaque nutricional: Proteína, ômega 3
Cuidados / observações: Conferir espinhas com os dedos
Status: Oferecer'),
('ALI-132', 'alimentos', 'Sardinha fresca', 6, NULL, NULL, 'Alimento: Sardinha fresca
Grupo alimentar (Guia MS): Carnes e ovos
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozido e desfiado, sem espinhas, misturado à comida
BLW / BLISS (6–8m): Lascas grandes sem espinhas; bolinhos de peixe
9–11m (pinça, todas as abordagens): Lascas pequenas
12m+ (mesa da família): Como na mesa da família, sempre sem espinhas
Alergênico: Peixe
Risco de engasgo: Médio
Destaque nutricional: Ômega 3, cálcio
Cuidados / observações: Enlatada tem muito sódio: evitar antes de 2 anos
Status: Oferecer'),
('ALI-133', 'alimentos', 'Salmão', 6, NULL, NULL, 'Alimento: Salmão
Grupo alimentar (Guia MS): Carnes e ovos
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozido e desfiado, sem espinhas, misturado à comida
BLW / BLISS (6–8m): Lascas grandes sem espinhas; bolinhos de peixe
9–11m (pinça, todas as abordagens): Lascas pequenas
12m+ (mesa da família): Como na mesa da família, sempre sem espinhas
Alergênico: Peixe
Risco de engasgo: Médio
Destaque nutricional: Ômega 3
Status: Oferecer'),
('ALI-134', 'alimentos', 'Atum fresco', 9, NULL, NULL, 'Alimento: Atum fresco
Grupo alimentar (Guia MS): Carnes e ovos
Idade mín. (meses): 9
Faixa etária: 9m+
Tradicional / papinha (6–8m): Cozido e desfiado, sem espinhas, misturado à comida
BLW / BLISS (6–8m): Lascas grandes sem espinhas; bolinhos de peixe
9–11m (pinça, todas as abordagens): Lascas pequenas
12m+ (mesa da família): Como na mesa da família, sempre sem espinhas
Alergênico: Peixe
Risco de engasgo: Médio
Destaque nutricional: Proteína
Cuidados / observações: Peixes grandes acumulam mercúrio: oferecer com moderação
Status: Oferecer'),
('ALI-135', 'alimentos', 'Camarão', 6, NULL, NULL, 'Alimento: Camarão
Grupo alimentar (Guia MS): Carnes e ovos
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Cozido e desfiado, sem espinhas, misturado à comida
BLW / BLISS (6–8m): Lascas grandes sem espinhas; bolinhos de peixe
9–11m (pinça, todas as abordagens): Lascas pequenas
12m+ (mesa da família): Como na mesa da família, sempre sem espinhas
Alergênico: Crustáceos
Risco de engasgo: Médio
Destaque nutricional: Proteína
Cuidados / observações: Bem cozido e picado; alergênico importante
Status: Oferecer'),
('ALI-136', 'alimentos', 'Ovo de galinha', 6, NULL, NULL, 'Alimento: Ovo de galinha
Grupo alimentar (Guia MS): Carnes e ovos
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Bem cozido, gema e clara, amassado
BLW / BLISS (6–8m): Omelete em tiras ou ovo cozido em quartos
9–11m (pinça, todas as abordagens): Mexido bem firme ou omelete em pedaços
12m+ (mesa da família): Qualquer preparo com clara e gema firmes
Alergênico: Ovo
Risco de engasgo: Baixo
Destaque nutricional: Proteína, colina, ferro
Cuidados / observações: Introduzir cedo (a partir de 6m) pode reduzir risco de alergia; sempre bem cozido
Status: Oferecer'),
('ALI-137', 'alimentos', 'Ovo de codorna', 6, NULL, NULL, 'Alimento: Ovo de codorna
Grupo alimentar (Guia MS): Carnes e ovos
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Bem cozido, gema e clara, amassado
BLW / BLISS (6–8m): Omelete em tiras ou ovo cozido em quartos
9–11m (pinça, todas as abordagens): Mexido bem firme ou omelete em pedaços
12m+ (mesa da família): Qualquer preparo com clara e gema firmes
Alergênico: Ovo
Risco de engasgo: Baixo
Destaque nutricional: Proteína
Cuidados / observações: Cozido e cortado em 4 (pequeno e redondo)
Status: Oferecer'),
('ALI-138', 'alimentos', 'Iogurte natural integral', 6, NULL, NULL, 'Alimento: Iogurte natural integral
Grupo alimentar (Guia MS): Leites e queijos
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Puro ou misturado à fruta, sem açúcar
BLW / BLISS (6–8m): Em colher pré-carregada para o bebê levar à boca; queijos em tiras finas ou ralados
9–11m (pinça, todas as abordagens): Com colher (a criança tenta) ou em pedaços
12m+ (mesa da família): Como parte das refeições
Alergênico: Leite
Risco de engasgo: Baixo
Destaque nutricional: Cálcio, proteína
Cuidados / observações: Sem açúcar; evitar iogurtes adoçados e ''petit suisse''
Status: Oferecer'),
('ALI-139', 'alimentos', 'Coalhada / kefir', 6, NULL, NULL, 'Alimento: Coalhada / kefir
Grupo alimentar (Guia MS): Leites e queijos
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Puro ou misturado à fruta, sem açúcar
BLW / BLISS (6–8m): Em colher pré-carregada para o bebê levar à boca; queijos em tiras finas ou ralados
9–11m (pinça, todas as abordagens): Com colher (a criança tenta) ou em pedaços
12m+ (mesa da família): Como parte das refeições
Alergênico: Leite
Risco de engasgo: Baixo
Destaque nutricional: Cálcio, probióticos
Cuidados / observações: Sem açúcar
Status: Oferecer'),
('ALI-140', 'alimentos', 'Queijo minas frescal', 6, NULL, NULL, 'Alimento: Queijo minas frescal
Grupo alimentar (Guia MS): Leites e queijos
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Puro ou misturado à fruta, sem açúcar
BLW / BLISS (6–8m): Em colher pré-carregada para o bebê levar à boca; queijos em tiras finas ou ralados
9–11m (pinça, todas as abordagens): Com colher (a criança tenta) ou em pedaços
12m+ (mesa da família): Como parte das refeições
Alergênico: Leite
Risco de engasgo: Baixo
Destaque nutricional: Cálcio, proteína
Cuidados / observações: Tem sódio: pequenas quantidades
Status: Oferecer'),
('ALI-141', 'alimentos', 'Ricota', 6, NULL, NULL, 'Alimento: Ricota
Grupo alimentar (Guia MS): Leites e queijos
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Puro ou misturado à fruta, sem açúcar
BLW / BLISS (6–8m): Em colher pré-carregada para o bebê levar à boca; queijos em tiras finas ou ralados
9–11m (pinça, todas as abordagens): Com colher (a criança tenta) ou em pedaços
12m+ (mesa da família): Como parte das refeições
Alergênico: Leite
Risco de engasgo: Baixo
Destaque nutricional: Cálcio, proteína
Cuidados / observações: Menor teor de sal
Status: Oferecer'),
('ALI-142', 'alimentos', 'Queijo cottage', 6, NULL, NULL, 'Alimento: Queijo cottage
Grupo alimentar (Guia MS): Leites e queijos
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Puro ou misturado à fruta, sem açúcar
BLW / BLISS (6–8m): Em colher pré-carregada para o bebê levar à boca; queijos em tiras finas ou ralados
9–11m (pinça, todas as abordagens): Com colher (a criança tenta) ou em pedaços
12m+ (mesa da família): Como parte das refeições
Alergênico: Leite
Risco de engasgo: Baixo
Destaque nutricional: Proteína
Status: Oferecer'),
('ALI-143', 'alimentos', 'Queijo muçarela', 9, NULL, NULL, 'Alimento: Queijo muçarela
Grupo alimentar (Guia MS): Leites e queijos
Idade mín. (meses): 9
Faixa etária: 9m+
Tradicional / papinha (6–8m): Puro ou misturado à fruta, sem açúcar
BLW / BLISS (6–8m): Em colher pré-carregada para o bebê levar à boca; queijos em tiras finas ou ralados
9–11m (pinça, todas as abordagens): Com colher (a criança tenta) ou em pedaços
12m+ (mesa da família): Como parte das refeições
Alergênico: Leite
Risco de engasgo: Baixo
Destaque nutricional: Cálcio
Cuidados / observações: Em tiras finas ou ralado derretido; pedaços grossos são borrachudos
Status: Oferecer'),
('ALI-144', 'alimentos', 'Queijo parmesão', 12, NULL, NULL, 'Alimento: Queijo parmesão
Grupo alimentar (Guia MS): Leites e queijos
Idade mín. (meses): 12
Faixa etária: 1a+
Tradicional / papinha (6–8m): Puro ou misturado à fruta, sem açúcar
BLW / BLISS (6–8m): Em colher pré-carregada para o bebê levar à boca; queijos em tiras finas ou ralados
9–11m (pinça, todas as abordagens): Com colher (a criança tenta) ou em pedaços
12m+ (mesa da família): Como parte das refeições
Alergênico: Leite
Risco de engasgo: Baixo
Destaque nutricional: Cálcio
Cuidados / observações: Muito sódio: só para dar sabor, pouca quantidade
Status: Oferecer'),
('ALI-145', 'alimentos', 'Manteiga', 6, NULL, NULL, 'Alimento: Manteiga
Grupo alimentar (Guia MS): Gorduras
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Pequena quantidade na comida pronta
BLW / BLISS (6–8m): Nas preparações
9–11m (pinça, todas as abordagens): Nas preparações
12m+ (mesa da família): Nas preparações
Alergênico: Leite
Risco de engasgo: Baixo
Destaque nutricional: Gordura
Cuidados / observações: Sem sal
Status: Oferecer'),
('ALI-146', 'alimentos', 'Leite de vaca integral (como bebida)', 12, NULL, NULL, 'Alimento: Leite de vaca integral (como bebida)
Grupo alimentar (Guia MS): Leites e queijos
Idade mín. (meses): 12
Faixa etária: 1a+
Tradicional / papinha (6–8m): Puro ou misturado à fruta, sem açúcar
BLW / BLISS (6–8m): Em colher pré-carregada para o bebê levar à boca; queijos em tiras finas ou ralados
9–11m (pinça, todas as abordagens): Com colher (a criança tenta) ou em pedaços
12m+ (mesa da família): Como parte das refeições
Alergênico: Leite
Risco de engasgo: Baixo
Destaque nutricional: Cálcio
Cuidados / observações: Não oferecer como bebida antes de 12 meses (orientação SBP); pode ir em preparações cozidas antes, conforme orientação profissional
Status: Oferecer'),
('ALI-147', 'alimentos', 'Amendoim', 6, NULL, NULL, 'Alimento: Amendoim
Grupo alimentar (Guia MS): Amendoim, castanhas e sementes
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Pasta fina diluída em água, fruta ou mingau; ou farinha polvilhada
BLW / BLISS (6–8m): Pasta fina espalhada em torrada/fruta ou farinha em preparações; nunca inteira
9–11m (pinça, todas as abordagens): Farinha ou pasta fina
12m+ (mesa da família): Pasta ou farinha; inteira apenas a partir de cerca de 4–5 anos
Alergênico: Amendoim
Risco de engasgo: Alto (inteira)
Destaque nutricional: Gorduras boas, proteína
Cuidados / observações: Introdução precoce em pasta pode reduzir alergia; em bebês com eczema grave ou alergia a ovo, conversar antes com o pediatra
Status: Oferecer'),
('ALI-148', 'alimentos', 'Castanha-de-caju', 6, NULL, NULL, 'Alimento: Castanha-de-caju
Grupo alimentar (Guia MS): Amendoim, castanhas e sementes
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Pasta fina diluída em água, fruta ou mingau; ou farinha polvilhada
BLW / BLISS (6–8m): Pasta fina espalhada em torrada/fruta ou farinha em preparações; nunca inteira
9–11m (pinça, todas as abordagens): Farinha ou pasta fina
12m+ (mesa da família): Pasta ou farinha; inteira apenas a partir de cerca de 4–5 anos
Alergênico: Castanhas
Risco de engasgo: Alto (inteira)
Destaque nutricional: Zinco, gorduras
Status: Oferecer'),
('ALI-149', 'alimentos', 'Castanha-do-pará', 6, NULL, NULL, 'Alimento: Castanha-do-pará
Grupo alimentar (Guia MS): Amendoim, castanhas e sementes
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Pasta fina diluída em água, fruta ou mingau; ou farinha polvilhada
BLW / BLISS (6–8m): Pasta fina espalhada em torrada/fruta ou farinha em preparações; nunca inteira
9–11m (pinça, todas as abordagens): Farinha ou pasta fina
12m+ (mesa da família): Pasta ou farinha; inteira apenas a partir de cerca de 4–5 anos
Alergênico: Castanhas
Risco de engasgo: Alto (inteira)
Destaque nutricional: Selênio
Cuidados / observações: Pouca quantidade (muito selênio)
Status: Oferecer'),
('ALI-150', 'alimentos', 'Nozes', 6, NULL, NULL, 'Alimento: Nozes
Grupo alimentar (Guia MS): Amendoim, castanhas e sementes
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Pasta fina diluída em água, fruta ou mingau; ou farinha polvilhada
BLW / BLISS (6–8m): Pasta fina espalhada em torrada/fruta ou farinha em preparações; nunca inteira
9–11m (pinça, todas as abordagens): Farinha ou pasta fina
12m+ (mesa da família): Pasta ou farinha; inteira apenas a partir de cerca de 4–5 anos
Alergênico: Castanhas
Risco de engasgo: Alto (inteira)
Destaque nutricional: Ômega 3
Status: Oferecer'),
('ALI-151', 'alimentos', 'Amêndoa', 6, NULL, NULL, 'Alimento: Amêndoa
Grupo alimentar (Guia MS): Amendoim, castanhas e sementes
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Pasta fina diluída em água, fruta ou mingau; ou farinha polvilhada
BLW / BLISS (6–8m): Pasta fina espalhada em torrada/fruta ou farinha em preparações; nunca inteira
9–11m (pinça, todas as abordagens): Farinha ou pasta fina
12m+ (mesa da família): Pasta ou farinha; inteira apenas a partir de cerca de 4–5 anos
Alergênico: Castanhas
Risco de engasgo: Alto (inteira)
Destaque nutricional: Cálcio, vitamina E
Status: Oferecer'),
('ALI-152', 'alimentos', 'Avelã', 6, NULL, NULL, 'Alimento: Avelã
Grupo alimentar (Guia MS): Amendoim, castanhas e sementes
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Pasta fina diluída em água, fruta ou mingau; ou farinha polvilhada
BLW / BLISS (6–8m): Pasta fina espalhada em torrada/fruta ou farinha em preparações; nunca inteira
9–11m (pinça, todas as abordagens): Farinha ou pasta fina
12m+ (mesa da família): Pasta ou farinha; inteira apenas a partir de cerca de 4–5 anos
Alergênico: Castanhas
Risco de engasgo: Alto (inteira)
Destaque nutricional: Vitamina E
Cuidados / observações: Evitar cremes de avelã com açúcar
Status: Oferecer'),
('ALI-153', 'alimentos', 'Gergelim / tahine', 6, NULL, NULL, 'Alimento: Gergelim / tahine
Grupo alimentar (Guia MS): Amendoim, castanhas e sementes
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Pasta fina diluída em água, fruta ou mingau; ou farinha polvilhada
BLW / BLISS (6–8m): Pasta fina espalhada em torrada/fruta ou farinha em preparações; nunca inteira
9–11m (pinça, todas as abordagens): Farinha ou pasta fina
12m+ (mesa da família): Pasta ou farinha; inteira apenas a partir de cerca de 4–5 anos
Alergênico: Gergelim
Risco de engasgo: Alto (inteira)
Destaque nutricional: Cálcio
Cuidados / observações: Tahine espalhado ou no homus
Status: Oferecer'),
('ALI-154', 'alimentos', 'Chia', 6, NULL, NULL, 'Alimento: Chia
Grupo alimentar (Guia MS): Amendoim, castanhas e sementes
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Pasta fina diluída em água, fruta ou mingau; ou farinha polvilhada
BLW / BLISS (6–8m): Pasta fina espalhada em torrada/fruta ou farinha em preparações; nunca inteira
9–11m (pinça, todas as abordagens): Farinha ou pasta fina
12m+ (mesa da família): Pasta ou farinha; inteira apenas a partir de cerca de 4–5 anos
Risco de engasgo: Alto (inteira)
Destaque nutricional: Ômega 3, fibras
Cuidados / observações: Sempre hidratada (seca incha na boca)
Status: Oferecer'),
('ALI-155', 'alimentos', 'Linhaça', 6, NULL, NULL, 'Alimento: Linhaça
Grupo alimentar (Guia MS): Amendoim, castanhas e sementes
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Pasta fina diluída em água, fruta ou mingau; ou farinha polvilhada
BLW / BLISS (6–8m): Pasta fina espalhada em torrada/fruta ou farinha em preparações; nunca inteira
9–11m (pinça, todas as abordagens): Farinha ou pasta fina
12m+ (mesa da família): Pasta ou farinha; inteira apenas a partir de cerca de 4–5 anos
Risco de engasgo: Alto (inteira)
Destaque nutricional: Ômega 3, fibras
Cuidados / observações: Moída
Status: Oferecer'),
('ALI-156', 'alimentos', 'Semente de abóbora', 6, NULL, NULL, 'Alimento: Semente de abóbora
Grupo alimentar (Guia MS): Amendoim, castanhas e sementes
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Pasta fina diluída em água, fruta ou mingau; ou farinha polvilhada
BLW / BLISS (6–8m): Pasta fina espalhada em torrada/fruta ou farinha em preparações; nunca inteira
9–11m (pinça, todas as abordagens): Farinha ou pasta fina
12m+ (mesa da família): Pasta ou farinha; inteira apenas a partir de cerca de 4–5 anos
Risco de engasgo: Alto (inteira)
Destaque nutricional: Zinco, ferro
Cuidados / observações: Moída em farinha
Status: Oferecer'),
('ALI-157', 'alimentos', 'Azeite de oliva', 6, NULL, NULL, 'Alimento: Azeite de oliva
Grupo alimentar (Guia MS): Gorduras
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Pequena quantidade na comida pronta
BLW / BLISS (6–8m): Nas preparações
9–11m (pinça, todas as abordagens): Nas preparações
12m+ (mesa da família): Nas preparações
Risco de engasgo: Baixo
Destaque nutricional: Gorduras boas
Cuidados / observações: Um fio na comida pronta
Status: Oferecer'),
('ALI-158', 'alimentos', 'Óleo de coco', 6, NULL, NULL, 'Alimento: Óleo de coco
Grupo alimentar (Guia MS): Gorduras
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Pequena quantidade na comida pronta
BLW / BLISS (6–8m): Nas preparações
9–11m (pinça, todas as abordagens): Nas preparações
12m+ (mesa da família): Nas preparações
Risco de engasgo: Baixo
Destaque nutricional: Gordura
Cuidados / observações: Moderação
Status: Oferecer'),
('ALI-159', 'alimentos', 'Alho', 6, NULL, NULL, 'Alimento: Alho
Grupo alimentar (Guia MS): Temperos naturais
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Usar desde o início para dar sabor, sem sal
BLW / BLISS (6–8m): Nas preparações
9–11m (pinça, todas as abordagens): Nas preparações
12m+ (mesa da família): Nas preparações
Risco de engasgo: Baixo
Destaque nutricional: Sabor
Status: Oferecer'),
('ALI-160', 'alimentos', 'Salsinha', 6, NULL, NULL, 'Alimento: Salsinha
Grupo alimentar (Guia MS): Temperos naturais
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Usar desde o início para dar sabor, sem sal
BLW / BLISS (6–8m): Nas preparações
9–11m (pinça, todas as abordagens): Nas preparações
12m+ (mesa da família): Nas preparações
Risco de engasgo: Baixo
Destaque nutricional: Vitamina C
Status: Oferecer'),
('ALI-161', 'alimentos', 'Cebolinha', 6, NULL, NULL, 'Alimento: Cebolinha
Grupo alimentar (Guia MS): Temperos naturais
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Usar desde o início para dar sabor, sem sal
BLW / BLISS (6–8m): Nas preparações
9–11m (pinça, todas as abordagens): Nas preparações
12m+ (mesa da família): Nas preparações
Risco de engasgo: Baixo
Destaque nutricional: Sabor
Status: Oferecer'),
('ALI-162', 'alimentos', 'Coentro', 6, NULL, NULL, 'Alimento: Coentro
Grupo alimentar (Guia MS): Temperos naturais
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Usar desde o início para dar sabor, sem sal
BLW / BLISS (6–8m): Nas preparações
9–11m (pinça, todas as abordagens): Nas preparações
12m+ (mesa da família): Nas preparações
Risco de engasgo: Baixo
Destaque nutricional: Sabor
Status: Oferecer'),
('ALI-163', 'alimentos', 'Manjericão', 6, NULL, NULL, 'Alimento: Manjericão
Grupo alimentar (Guia MS): Temperos naturais
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Usar desde o início para dar sabor, sem sal
BLW / BLISS (6–8m): Nas preparações
9–11m (pinça, todas as abordagens): Nas preparações
12m+ (mesa da família): Nas preparações
Risco de engasgo: Baixo
Destaque nutricional: Sabor
Status: Oferecer'),
('ALI-164', 'alimentos', 'Hortelã', 6, NULL, NULL, 'Alimento: Hortelã
Grupo alimentar (Guia MS): Temperos naturais
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Usar desde o início para dar sabor, sem sal
BLW / BLISS (6–8m): Nas preparações
9–11m (pinça, todas as abordagens): Nas preparações
12m+ (mesa da família): Nas preparações
Risco de engasgo: Baixo
Destaque nutricional: Sabor
Status: Oferecer'),
('ALI-165', 'alimentos', 'Orégano', 6, NULL, NULL, 'Alimento: Orégano
Grupo alimentar (Guia MS): Temperos naturais
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Usar desde o início para dar sabor, sem sal
BLW / BLISS (6–8m): Nas preparações
9–11m (pinça, todas as abordagens): Nas preparações
12m+ (mesa da família): Nas preparações
Risco de engasgo: Baixo
Destaque nutricional: Sabor
Status: Oferecer'),
('ALI-166', 'alimentos', 'Alecrim', 6, NULL, NULL, 'Alimento: Alecrim
Grupo alimentar (Guia MS): Temperos naturais
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Usar desde o início para dar sabor, sem sal
BLW / BLISS (6–8m): Nas preparações
9–11m (pinça, todas as abordagens): Nas preparações
12m+ (mesa da família): Nas preparações
Risco de engasgo: Baixo
Destaque nutricional: Sabor
Cuidados / observações: Retirar os raminhos duros
Status: Oferecer'),
('ALI-167', 'alimentos', 'Tomilho', 6, NULL, NULL, 'Alimento: Tomilho
Grupo alimentar (Guia MS): Temperos naturais
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Usar desde o início para dar sabor, sem sal
BLW / BLISS (6–8m): Nas preparações
9–11m (pinça, todas as abordagens): Nas preparações
12m+ (mesa da família): Nas preparações
Risco de engasgo: Baixo
Destaque nutricional: Sabor
Status: Oferecer'),
('ALI-168', 'alimentos', 'Louro', 6, NULL, NULL, 'Alimento: Louro
Grupo alimentar (Guia MS): Temperos naturais
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Usar desde o início para dar sabor, sem sal
BLW / BLISS (6–8m): Nas preparações
9–11m (pinça, todas as abordagens): Nas preparações
12m+ (mesa da família): Nas preparações
Risco de engasgo: Baixo
Destaque nutricional: Sabor
Cuidados / observações: Retirar a folha antes de servir
Status: Oferecer'),
('ALI-169', 'alimentos', 'Cúrcuma / açafrão-da-terra', 6, NULL, NULL, 'Alimento: Cúrcuma / açafrão-da-terra
Grupo alimentar (Guia MS): Temperos naturais
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Usar desde o início para dar sabor, sem sal
BLW / BLISS (6–8m): Nas preparações
9–11m (pinça, todas as abordagens): Nas preparações
12m+ (mesa da família): Nas preparações
Risco de engasgo: Baixo
Destaque nutricional: Cor e sabor
Status: Oferecer'),
('ALI-170', 'alimentos', 'Cominho', 6, NULL, NULL, 'Alimento: Cominho
Grupo alimentar (Guia MS): Temperos naturais
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Usar desde o início para dar sabor, sem sal
BLW / BLISS (6–8m): Nas preparações
9–11m (pinça, todas as abordagens): Nas preparações
12m+ (mesa da família): Nas preparações
Risco de engasgo: Baixo
Destaque nutricional: Sabor
Status: Oferecer'),
('ALI-171', 'alimentos', 'Canela', 6, NULL, NULL, 'Alimento: Canela
Grupo alimentar (Guia MS): Temperos naturais
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Usar desde o início para dar sabor, sem sal
BLW / BLISS (6–8m): Nas preparações
9–11m (pinça, todas as abordagens): Nas preparações
12m+ (mesa da família): Nas preparações
Risco de engasgo: Baixo
Destaque nutricional: Sabor adocicado sem açúcar
Status: Oferecer'),
('ALI-172', 'alimentos', 'Páprica doce', 6, NULL, NULL, 'Alimento: Páprica doce
Grupo alimentar (Guia MS): Temperos naturais
Idade mín. (meses): 6
Faixa etária: 6m+
Tradicional / papinha (6–8m): Usar desde o início para dar sabor, sem sal
BLW / BLISS (6–8m): Nas preparações
9–11m (pinça, todas as abordagens): Nas preparações
12m+ (mesa da família): Nas preparações
Risco de engasgo: Baixo
Destaque nutricional: Sabor
Cuidados / observações: Evitar pimentas ardidas no início
Status: Oferecer'),
('ALI-173', 'alimentos', 'Noz-moscada', 9, NULL, NULL, 'Alimento: Noz-moscada
Grupo alimentar (Guia MS): Temperos naturais
Idade mín. (meses): 9
Faixa etária: 9m+
Tradicional / papinha (6–8m): Usar desde o início para dar sabor, sem sal
BLW / BLISS (6–8m): Nas preparações
9–11m (pinça, todas as abordagens): Nas preparações
12m+ (mesa da família): Nas preparações
Risco de engasgo: Baixo
Destaque nutricional: Sabor
Cuidados / observações: Uma pitadinha
Status: Oferecer'),
('ALI-174', 'alimentos', 'Gengibre', 9, NULL, NULL, 'Alimento: Gengibre
Grupo alimentar (Guia MS): Temperos naturais
Idade mín. (meses): 9
Faixa etária: 9m+
Tradicional / papinha (6–8m): Usar desde o início para dar sabor, sem sal
BLW / BLISS (6–8m): Nas preparações
9–11m (pinça, todas as abordagens): Nas preparações
12m+ (mesa da família): Nas preparações
Risco de engasgo: Baixo
Destaque nutricional: Sabor
Cuidados / observações: Pouco, ralado
Status: Oferecer'),
('ALI-175', 'alimentos', 'Cravo', 9, NULL, NULL, 'Alimento: Cravo
Grupo alimentar (Guia MS): Temperos naturais
Idade mín. (meses): 9
Faixa etária: 9m+
Tradicional / papinha (6–8m): Usar desde o início para dar sabor, sem sal
BLW / BLISS (6–8m): Nas preparações
9–11m (pinça, todas as abordagens): Nas preparações
12m+ (mesa da família): Nas preparações
Risco de engasgo: Baixo
Destaque nutricional: Sabor
Cuidados / observações: Retirar antes de servir
Status: Oferecer'),
('ALI-176', 'alimentos', 'Mel', 12, NULL, NULL, 'Alimento: Mel
Grupo alimentar (Guia MS): Evitar / adiar
Idade mín. (meses): 12
Faixa etária: A partir de 1a
Tradicional / papinha (6–8m): Não oferecer
BLW / BLISS (6–8m): Não oferecer
9–11m (pinça, todas as abordagens): Não oferecer
12m+ (mesa da família): Ver cuidados
Cuidados / observações: Risco de botulismo infantil antes de 1 ano, inclusive em receitas assadas
Status: Evitar/adiar'),
('REC-001', 'receitas', 'Papinha salgada básica (almoço)', 6, NULL, NULL, 'Receita: Papinha salgada básica (almoço)
Refeição: Almoço/jantar
Idade mín. (meses): 6
Faixa etária: 6m+
Métodos compatíveis: Tradicional; Mista
Ingredientes: Arroz, feijão, abóbora, carne moída, cebola, azeite
Modo de preparo: Cozinhar tudo separado, sem sal; amassar cada alimento separadamente no prato para o bebê conhecer os sabores
Congela?: Sim
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-002', 'receitas', 'Bolinho de arroz e legumes assado', 6, NULL, NULL, 'Receita: Bolinho de arroz e legumes assado
Refeição: Almoço/jantar
Idade mín. (meses): 6
Faixa etária: 6m+
Métodos compatíveis: BLW; BLISS; Mista
Ingredientes: Arroz cozido, cenoura ralada, ovo, salsinha, aveia
Modo de preparo: Misturar, modelar bolinhos alongados e assar a 180 °C por 20 min
Alergênicos: Ovo
Congela?: Sim
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-003', 'receitas', 'Hambúrguer de feijão', 6, NULL, NULL, 'Receita: Hambúrguer de feijão
Refeição: Almoço/jantar
Idade mín. (meses): 6
Faixa etária: 6m+
Métodos compatíveis: BLW; BLISS; Mista
Ingredientes: Feijão cozido escorrido, aveia, cebola refogada, cominho
Modo de preparo: Amassar tudo, modelar e dourar na frigideira com fio de azeite
Congela?: Sim
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-004', 'receitas', 'Hambúrguer de lentilha e cenoura', 6, NULL, NULL, 'Receita: Hambúrguer de lentilha e cenoura
Refeição: Almoço/jantar
Idade mín. (meses): 6
Faixa etária: 6m+
Métodos compatíveis: BLW; BLISS
Ingredientes: Lentilha cozida, cenoura ralada, farinha de aveia
Modo de preparo: Amassar, modelar e assar
Congela?: Sim
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-005', 'receitas', 'Almôndega de carne e abobrinha', 6, NULL, NULL, 'Receita: Almôndega de carne e abobrinha
Refeição: Almoço/jantar
Idade mín. (meses): 6
Faixa etária: 6m+
Métodos compatíveis: BLW; BLISS; Mista
Ingredientes: Carne moída, abobrinha ralada espremida, cebola, ovo
Modo de preparo: Modelar em formato alongado e assar ou cozinhar em molho de tomate caseiro
Alergênicos: Ovo
Congela?: Sim
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-006', 'receitas', 'Frango desfiado com mandioquinha', 6, NULL, NULL, 'Receita: Frango desfiado com mandioquinha
Refeição: Almoço/jantar
Idade mín. (meses): 6
Faixa etária: 6m+
Métodos compatíveis: Tradicional; Mista
Ingredientes: Coxa de frango, mandioquinha, cebola, alho, salsinha
Modo de preparo: Cozinhar o frango no caldo com temperos, desfiar; amassar a mandioquinha
Congela?: Sim
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-007', 'receitas', 'Omelete de espinafre em tiras', 6, NULL, NULL, 'Receita: Omelete de espinafre em tiras
Refeição: Café/almoço
Idade mín. (meses): 6
Faixa etária: 6m+
Métodos compatíveis: BLW; BLISS; Mista
Ingredientes: Ovo, espinafre picado, cebola
Modo de preparo: Bater, cozinhar em frigideira até ficar bem firme e cortar em tiras
Alergênicos: Ovo
Congela?: Não
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-008', 'receitas', 'Panqueca de banana e aveia (2 ingredientes)', 6, NULL, NULL, 'Receita: Panqueca de banana e aveia (2 ingredientes)
Refeição: Café/lanche
Idade mín. (meses): 6
Faixa etária: 6m+
Métodos compatíveis: BLW; BLISS; Mista
Ingredientes: Banana madura, ovo, aveia (opcional)
Modo de preparo: Amassar a banana, bater com o ovo, cozinhar pequenas panquecas em frigideira antiaderente
Alergênicos: Ovo
Congela?: Sim
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-009', 'receitas', 'Panqueca de banana sem ovo', 6, NULL, NULL, 'Receita: Panqueca de banana sem ovo
Refeição: Café/lanche
Idade mín. (meses): 6
Faixa etária: 6m+
Métodos compatíveis: BLW; Mista
Ingredientes: Banana, aveia, água ou leite materno
Modo de preparo: Misturar até formar massa grossa e cozinhar em fogo baixo
Congela?: Sim
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-010', 'receitas', 'Mingau de aveia com fruta', 6, NULL, NULL, 'Receita: Mingau de aveia com fruta
Refeição: Café/lanche
Idade mín. (meses): 6
Faixa etária: 6m+
Métodos compatíveis: Tradicional; Mista
Ingredientes: Aveia, água ou leite materno/fórmula, maçã ralada, canela
Modo de preparo: Cozinhar a aveia na água, juntar a fruta e canela, sem açúcar
Congela?: Não
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-011', 'receitas', 'Homus', 6, NULL, NULL, 'Receita: Homus
Refeição: Lanche/acompanhamento
Idade mín. (meses): 6
Faixa etária: 6m+
Métodos compatíveis: Todos
Ingredientes: Grão-de-bico cozido, tahine, limão, azeite, alho
Modo de preparo: Bater até ficar liso; servir em colher pré-carregada, torrada ou com palitos de legumes
Alergênicos: Gergelim
Congela?: Sim
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-012', 'receitas', 'Polenta mole com molho de carne', 6, NULL, NULL, 'Receita: Polenta mole com molho de carne
Refeição: Almoço/jantar
Idade mín. (meses): 6
Faixa etária: 6m+
Métodos compatíveis: Tradicional; Mista
Ingredientes: Fubá, água, carne moída, tomate, cebola
Modo de preparo: Cozinhar a polenta; refogar a carne com tomate; servir por cima
Congela?: Sim
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-013', 'receitas', 'Palitos de polenta assada', 6, NULL, NULL, 'Receita: Palitos de polenta assada
Refeição: Almoço/lanche
Idade mín. (meses): 6
Faixa etária: 6m+
Métodos compatíveis: BLW; BLISS
Ingredientes: Polenta firme, azeite, orégano
Modo de preparo: Espalhar a polenta em forma, esfriar, cortar em palitos e assar até dourar
Congela?: Sim
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-014', 'receitas', 'Palitos de batata-doce assada', 6, NULL, NULL, 'Receita: Palitos de batata-doce assada
Refeição: Almoço/lanche
Idade mín. (meses): 6
Faixa etária: 6m+
Métodos compatíveis: BLW; BLISS; Mista
Ingredientes: Batata-doce, azeite, páprica doce
Modo de preparo: Cortar palitos grossos e assar até ficarem macios por dentro
Congela?: Não
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-015', 'receitas', 'Sopa de legumes com carne (não liquidificada)', 6, NULL, NULL, 'Receita: Sopa de legumes com carne (não liquidificada)
Refeição: Jantar
Idade mín. (meses): 6
Faixa etária: 6m+
Métodos compatíveis: Tradicional; Mista
Ingredientes: Músculo, batata, cenoura, chuchu, couve
Modo de preparo: Cozinhar lentamente; servir amassado, não batido
Congela?: Sim
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-016', 'receitas', 'Caldinho de feijão com grãos amassados', 6, NULL, NULL, 'Receita: Caldinho de feijão com grãos amassados
Refeição: Almoço/jantar
Idade mín. (meses): 6
Faixa etária: 6m+
Métodos compatíveis: Tradicional; Mista
Ingredientes: Feijão, cebola, alho, louro
Modo de preparo: Cozinhar e amassar os grãos no próprio caldo
Congela?: Sim
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-017', 'receitas', 'Purê de abóbora com ricota', 6, NULL, NULL, 'Receita: Purê de abóbora com ricota
Refeição: Almoço/jantar
Idade mín. (meses): 6
Faixa etária: 6m+
Métodos compatíveis: Tradicional; Mista
Ingredientes: Abóbora, ricota, noz-moscada
Modo de preparo: Cozinhar a abóbora, amassar e misturar a ricota
Alergênicos: Leite
Congela?: Sim
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-018', 'receitas', 'Peixe assado com batata e brócolis', 6, NULL, NULL, 'Receita: Peixe assado com batata e brócolis
Refeição: Almoço/jantar
Idade mín. (meses): 6
Faixa etária: 6m+
Métodos compatíveis: Todos
Ingredientes: Tilápia, batata, brócolis, limão, azeite
Modo de preparo: Assar tudo em papelote; desfiar o peixe conferindo espinhas
Alergênicos: Peixe
Congela?: Não
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-019', 'receitas', 'Bolinho de peixe', 6, NULL, NULL, 'Receita: Bolinho de peixe
Refeição: Almoço/jantar
Idade mín. (meses): 6
Faixa etária: 6m+
Métodos compatíveis: BLW; BLISS
Ingredientes: Peixe cozido desfiado, batata amassada, salsinha
Modo de preparo: Misturar, modelar e assar
Alergênicos: Peixe
Congela?: Sim
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-020', 'receitas', 'Muffin salgado de legumes', 9, NULL, NULL, 'Receita: Muffin salgado de legumes
Refeição: Lanche
Idade mín. (meses): 9
Faixa etária: 9m+
Métodos compatíveis: BLW; BLISS; Mista
Ingredientes: Ovo, aveia, abobrinha ralada, cenoura ralada, queijo ralado
Modo de preparo: Misturar e assar em forminhas por 20–25 min
Alergênicos: Ovo; leite
Congela?: Sim
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-021', 'receitas', 'Muffin de banana sem açúcar', 9, NULL, NULL, 'Receita: Muffin de banana sem açúcar
Refeição: Lanche
Idade mín. (meses): 9
Faixa etária: 9m+
Métodos compatíveis: BLW; Mista
Ingredientes: Banana, ovo, aveia, fermento, canela
Modo de preparo: Misturar e assar em forminhas
Alergênicos: Ovo
Congela?: Sim
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-022', 'receitas', 'Bolo de cenoura sem açúcar (com tâmaras)', 12, NULL, NULL, 'Receita: Bolo de cenoura sem açúcar (com tâmaras)
Refeição: Lanche
Idade mín. (meses): 12
Faixa etária: 1a+
Métodos compatíveis: Todos
Ingredientes: Cenoura, ovo, tâmaras, óleo, farinha de aveia, fermento
Modo de preparo: Bater cenoura, ovos, tâmaras e óleo; misturar farinha e fermento; assar
Alergênicos: Ovo
Congela?: Sim
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-023', 'receitas', 'Cookie de aveia e banana', 9, NULL, NULL, 'Receita: Cookie de aveia e banana
Refeição: Lanche
Idade mín. (meses): 9
Faixa etária: 9m+
Métodos compatíveis: BLW; Mista
Ingredientes: Banana, aveia, uva-passa picada (12m+)
Modo de preparo: Amassar, modelar e assar até firmar
Congela?: Sim
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-024', 'receitas', 'Iogurte com fruta amassada', 6, NULL, NULL, 'Receita: Iogurte com fruta amassada
Refeição: Lanche
Idade mín. (meses): 6
Faixa etária: 6m+
Métodos compatíveis: Todos
Ingredientes: Iogurte natural integral, manga ou morango
Modo de preparo: Misturar a fruta amassada ao iogurte, sem açúcar
Alergênicos: Leite
Congela?: Não
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-025', 'receitas', 'Pasta de amendoim com banana', 6, NULL, NULL, 'Receita: Pasta de amendoim com banana
Refeição: Lanche
Idade mín. (meses): 6
Faixa etária: 6m+
Métodos compatíveis: Todos
Ingredientes: Pasta de amendoim 100% sem açúcar, banana
Modo de preparo: Espalhar fina camada de pasta diluída sobre a banana
Alergênicos: Amendoim
Congela?: Não
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-026', 'receitas', 'Macarrão com molho de tomate e carne', 6, NULL, NULL, 'Receita: Macarrão com molho de tomate e carne
Refeição: Almoço/jantar
Idade mín. (meses): 6
Faixa etária: 6m+
Métodos compatíveis: Todos
Ingredientes: Macarrão parafuso, tomate, carne moída, manjericão
Modo de preparo: Molho caseiro sem sal; macarrão bem cozido
Alergênicos: Trigo
Congela?: Sim (molho)
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-027', 'receitas', 'Macarrão com molho verde (brócolis)', 9, NULL, NULL, 'Receita: Macarrão com molho verde (brócolis)
Refeição: Almoço/jantar
Idade mín. (meses): 9
Faixa etária: 9m+
Métodos compatíveis: Todos
Ingredientes: Macarrão, brócolis, azeite, alho, queijo
Modo de preparo: Bater o brócolis cozido com azeite e alho
Alergênicos: Trigo; leite
Congela?: Sim (molho)
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-028', 'receitas', 'Risoto de abóbora e frango', 9, NULL, NULL, 'Receita: Risoto de abóbora e frango
Refeição: Almoço/jantar
Idade mín. (meses): 9
Faixa etária: 9m+
Métodos compatíveis: Todos
Ingredientes: Arroz, abóbora, frango desfiado, cebola
Modo de preparo: Cozinhar o arroz com caldo caseiro e a abóbora até cremoso
Congela?: Sim
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-029', 'receitas', 'Arroz com lentilha (mujadara)', 9, NULL, NULL, 'Receita: Arroz com lentilha (mujadara)
Refeição: Almoço/jantar
Idade mín. (meses): 9
Faixa etária: 9m+
Métodos compatíveis: Todos
Ingredientes: Arroz, lentilha, cebola dourada, cominho
Modo de preparo: Cozinhar juntos; cebola bem macia
Congela?: Sim
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-030', 'receitas', 'Cuscuz nordestino com ovo', 9, NULL, NULL, 'Receita: Cuscuz nordestino com ovo
Refeição: Café/jantar
Idade mín. (meses): 9
Faixa etária: 9m+
Métodos compatíveis: Todos
Ingredientes: Flocão de milho, água, ovo mexido firme
Modo de preparo: Hidratar o flocão e cozinhar no vapor; servir úmido com ovo
Alergênicos: Ovo
Congela?: Não
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-031', 'receitas', 'Tapioca com queijo e tomate', 12, NULL, NULL, 'Receita: Tapioca com queijo e tomate
Refeição: Café/lanche
Idade mín. (meses): 12
Faixa etária: 1a+
Métodos compatíveis: Mista; Família
Ingredientes: Goma, ricota ou minas, tomate
Modo de preparo: Tapioca fina com recheio úmido, cortada em tiras
Alergênicos: Leite
Congela?: Não
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-032', 'receitas', 'Crepioca', 9, NULL, NULL, 'Receita: Crepioca
Refeição: Café/lanche
Idade mín. (meses): 9
Faixa etária: 9m+
Métodos compatíveis: BLW; Mista
Ingredientes: Ovo, goma de tapioca
Modo de preparo: Bater e cozinhar em frigideira; cortar em tiras
Alergênicos: Ovo
Congela?: Não
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-033', 'receitas', 'Pão de queijo caseiro de mandioquinha', 12, NULL, NULL, 'Receita: Pão de queijo caseiro de mandioquinha
Refeição: Lanche
Idade mín. (meses): 12
Faixa etária: 1a+
Métodos compatíveis: Todos
Ingredientes: Mandioquinha, polvilho, queijo, azeite
Modo de preparo: Amassar, bolear e assar
Alergênicos: Leite
Congela?: Sim (cru)
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-034', 'receitas', 'Escondidinho de mandioca com carne', 9, NULL, NULL, 'Receita: Escondidinho de mandioca com carne
Refeição: Almoço/jantar
Idade mín. (meses): 9
Faixa etária: 9m+
Métodos compatíveis: Todos
Ingredientes: Mandioca, carne desfiada, cebola, tomate
Modo de preparo: Purê de mandioca por cima da carne refogada, assar
Congela?: Sim
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-035', 'receitas', 'Quibe de forno com abóbora', 12, NULL, NULL, 'Receita: Quibe de forno com abóbora
Refeição: Almoço/jantar
Idade mín. (meses): 12
Faixa etária: 1a+
Métodos compatíveis: Todos
Ingredientes: Trigo para quibe, abóbora, carne moída, hortelã
Modo de preparo: Montar camadas e assar
Alergênicos: Trigo
Congela?: Sim
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-036', 'receitas', 'Picadinho de carne com legumes', 9, NULL, NULL, 'Receita: Picadinho de carne com legumes
Refeição: Almoço/jantar
Idade mín. (meses): 9
Faixa etária: 9m+
Métodos compatíveis: Todos
Ingredientes: Acém, cenoura, batata, vagem
Modo de preparo: Cozinhar em panela de pressão até desmanchar
Congela?: Sim
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-037', 'receitas', 'Feijoada infantil (sem embutidos)', 12, NULL, NULL, 'Receita: Feijoada infantil (sem embutidos)
Refeição: Almoço
Idade mín. (meses): 12
Faixa etária: 1a+
Métodos compatíveis: Família
Ingredientes: Feijão preto, carne magra, couve, laranja
Modo de preparo: Feijão com carne fresca e temperos, sem linguiça/bacon; couve refogada e laranja para vitamina C
Congela?: Sim
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-038', 'receitas', 'Galinhada', 9, NULL, NULL, 'Receita: Galinhada
Refeição: Almoço/jantar
Idade mín. (meses): 9
Faixa etária: 9m+
Métodos compatíveis: Todos
Ingredientes: Arroz, sobrecoxa, cúrcuma, milho, ervilha
Modo de preparo: Refogar o frango, juntar arroz, cúrcuma e água
Congela?: Sim
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-039', 'receitas', 'Moqueca de peixe suave', 12, NULL, NULL, 'Receita: Moqueca de peixe suave
Refeição: Almoço/jantar
Idade mín. (meses): 12
Faixa etária: 1a+
Métodos compatíveis: Família
Ingredientes: Peixe branco, tomate, pimentão, leite de coco, coentro
Modo de preparo: Cozinhar em camadas; sem pimenta ardida e sem sal extra
Alergênicos: Peixe; coco
Congela?: Não
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-040', 'receitas', 'Sopa de ervilha', 9, NULL, NULL, 'Receita: Sopa de ervilha
Refeição: Jantar
Idade mín. (meses): 9
Faixa etária: 9m+
Métodos compatíveis: Todos
Ingredientes: Ervilha seca, cenoura, cebola, louro
Modo de preparo: Cozinhar até desmanchar
Congela?: Sim
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-041', 'receitas', 'Canja', 6, NULL, NULL, 'Receita: Canja
Refeição: Jantar
Idade mín. (meses): 6
Faixa etária: 6m+
Métodos compatíveis: Tradicional; Mista
Ingredientes: Frango, arroz, cenoura, salsinha
Modo de preparo: Cozinhar e desfiar; amassar para os menores
Congela?: Sim
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-042', 'receitas', 'Nhoque de batata-doce', 9, NULL, NULL, 'Receita: Nhoque de batata-doce
Refeição: Almoço/jantar
Idade mín. (meses): 9
Faixa etária: 9m+
Métodos compatíveis: BLW; Mista
Ingredientes: Batata-doce, farinha de trigo ou aveia
Modo de preparo: Amassar, modelar rolinhos grossos, cozinhar
Alergênicos: Trigo (se usar)
Congela?: Sim
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-043', 'receitas', 'Waffle de legumes', 9, NULL, NULL, 'Receita: Waffle de legumes
Refeição: Café/lanche
Idade mín. (meses): 9
Faixa etária: 9m+
Métodos compatíveis: BLW; Mista
Ingredientes: Ovo, aveia, abobrinha ou beterraba ralada
Modo de preparo: Assar na máquina de waffle ou frigideira
Alergênicos: Ovo
Congela?: Sim
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-044', 'receitas', 'Fritata de forno', 9, NULL, NULL, 'Receita: Fritata de forno
Refeição: Almoço/jantar
Idade mín. (meses): 9
Faixa etária: 9m+
Métodos compatíveis: BLW; Mista
Ingredientes: Ovos, batata cozida, espinafre, tomate
Modo de preparo: Assar em forma e cortar em palitos
Alergênicos: Ovo
Congela?: Sim
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-045', 'receitas', 'Maçã assada com canela', 6, NULL, NULL, 'Receita: Maçã assada com canela
Refeição: Sobremesa/lanche
Idade mín. (meses): 6
Faixa etária: 6m+
Métodos compatíveis: Todos
Ingredientes: Maçã, canela
Modo de preparo: Assar a maçã fatiada até ficar macia
Congela?: Não
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-046', 'receitas', 'Picolé de fruta (para gengiva)', 9, NULL, NULL, 'Receita: Picolé de fruta (para gengiva)
Refeição: Lanche
Idade mín. (meses): 9
Faixa etária: 9m+
Métodos compatíveis: Todos
Ingredientes: Manga, banana, iogurte natural
Modo de preparo: Bater e congelar em forminhas pequenas
Alergênicos: Leite (se usar iogurte)
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-047', 'receitas', '''Sorvete'' de banana', 9, NULL, NULL, 'Receita: ''Sorvete'' de banana
Refeição: Sobremesa
Idade mín. (meses): 9
Faixa etária: 9m+
Métodos compatíveis: Todos
Ingredientes: Banana congelada
Modo de preparo: Bater a banana congelada até ficar cremosa
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-048', 'receitas', 'Vitamina de frutas com aveia (para 12m+)', 12, NULL, NULL, 'Receita: Vitamina de frutas com aveia (para 12m+)
Refeição: Lanche
Idade mín. (meses): 12
Faixa etária: 1a+
Métodos compatíveis: Família
Ingredientes: Leite ou iogurte, banana, mamão, aveia
Modo de preparo: Bater tudo; servir em copo aberto
Alergênicos: Leite
Congela?: Não
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-049', 'receitas', 'Creme de abacate com cacau (sem açúcar)', 12, NULL, NULL, 'Receita: Creme de abacate com cacau (sem açúcar)
Refeição: Sobremesa
Idade mín. (meses): 12
Faixa etária: 1a+
Métodos compatíveis: Todos
Ingredientes: Abacate, banana, cacau 100%
Modo de preparo: Bater até cremoso
Congela?: Não
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-050', 'receitas', 'Torrada com pasta de ricota e ervas', 9, NULL, NULL, 'Receita: Torrada com pasta de ricota e ervas
Refeição: Lanche
Idade mín. (meses): 9
Faixa etária: 9m+
Métodos compatíveis: BLW; Mista
Ingredientes: Pão caseiro, ricota, azeite, salsinha
Modo de preparo: Tostar o pão, cortar em tiras e espalhar a pasta
Alergênicos: Trigo; leite
Congela?: Não
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-051', 'receitas', 'Guacamole infantil', 6, NULL, NULL, 'Receita: Guacamole infantil
Refeição: Acompanhamento
Idade mín. (meses): 6
Faixa etária: 6m+
Métodos compatíveis: Todos
Ingredientes: Abacate, tomate sem sementes, limão, coentro
Modo de preparo: Amassar tudo
Congela?: Não
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-052', 'receitas', 'Legumes assados coloridos', 6, NULL, NULL, 'Receita: Legumes assados coloridos
Refeição: Acompanhamento
Idade mín. (meses): 6
Faixa etária: 6m+
Métodos compatíveis: BLW; BLISS
Ingredientes: Abóbora, cenoura, beterraba, abobrinha
Modo de preparo: Cortar em palitos grossos, regar com azeite, assar
Congela?: Não
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-053', 'receitas', 'Couve refogada com ovo', 9, NULL, NULL, 'Receita: Couve refogada com ovo
Refeição: Almoço
Idade mín. (meses): 9
Faixa etária: 9m+
Métodos compatíveis: Todos
Ingredientes: Couve fininha, ovo, alho
Modo de preparo: Refogar a couve e misturar ovo mexido firme
Alergênicos: Ovo
Congela?: Não
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-054', 'receitas', 'Bolinho de quinoa', 9, NULL, NULL, 'Receita: Bolinho de quinoa
Refeição: Almoço/lanche
Idade mín. (meses): 9
Faixa etária: 9m+
Métodos compatíveis: BLW; BLISS
Ingredientes: Quinoa cozida, ovo, cenoura ralada
Modo de preparo: Modelar e assar
Alergênicos: Ovo
Congela?: Sim
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-055', 'receitas', 'Tofu grelhado com gergelim', 9, NULL, NULL, 'Receita: Tofu grelhado com gergelim
Refeição: Almoço/jantar
Idade mín. (meses): 9
Faixa etária: 9m+
Métodos compatíveis: BLW; Mista
Ingredientes: Tofu firme, gergelim moído, cebolinha
Modo de preparo: Cortar tiras e grelhar
Alergênicos: Soja; gergelim
Congela?: Não
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-056', 'receitas', 'Estrogonofe caseiro de frango (sem creme industrial)', 12, NULL, NULL, 'Receita: Estrogonofe caseiro de frango (sem creme industrial)
Refeição: Almoço/jantar
Idade mín. (meses): 12
Faixa etária: 1a+
Métodos compatíveis: Família
Ingredientes: Frango, tomate, cebola, cogumelo, iogurte natural
Modo de preparo: Refogar e finalizar com iogurte fora do fogo
Alergênicos: Leite
Congela?: Sim
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-057', 'receitas', 'Chips de legumes assados', 12, NULL, NULL, 'Receita: Chips de legumes assados
Refeição: Lanche
Idade mín. (meses): 12
Faixa etária: 1a+
Métodos compatíveis: Família
Ingredientes: Batata-doce, beterraba em lâminas finas
Modo de preparo: Assar até ficarem secos; oferecer com supervisão
Congela?: Não
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-058', 'receitas', 'Barrinha de tâmara e aveia (sem açúcar)', 12, NULL, NULL, 'Receita: Barrinha de tâmara e aveia (sem açúcar)
Refeição: Lanche
Idade mín. (meses): 12
Faixa etária: 1a+
Métodos compatíveis: Família
Ingredientes: Tâmaras, aveia, pasta de castanha
Modo de preparo: Processar, prensar em forma e cortar
Alergênicos: Castanhas
Congela?: Sim
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-059', 'receitas', 'Papinha de fruta com cereal (lanche)', 6, NULL, NULL, 'Receita: Papinha de fruta com cereal (lanche)
Refeição: Lanche
Idade mín. (meses): 6
Faixa etária: 6m+
Métodos compatíveis: Tradicional
Ingredientes: Banana ou mamão, aveia ou amaranto
Modo de preparo: Amassar a fruta e misturar o cereal
Congela?: Não
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('REC-060', 'receitas', 'Pirão de peixe', 9, NULL, NULL, 'Receita: Pirão de peixe
Refeição: Almoço
Idade mín. (meses): 9
Faixa etária: 9m+
Métodos compatíveis: Tradicional; Mista
Ingredientes: Caldo de peixe caseiro, farinha de mandioca
Modo de preparo: Cozinhar a farinha no caldo até formar creme úmido
Alergênicos: Peixe
Congela?: Não
Observação: Sem sal e sem açúcar até 1 ano; ajustar textura à idade'),
('MET-001', 'metodos_alimentacao', 'Tradicional / papinhas (amassado)', NULL, NULL, NULL, 'Método: Tradicional / papinhas (amassado)
Como funciona: Alimentos cozidos amassados com garfo, oferecidos com colher pelo adulto, evoluindo a textura até a comida da família por volta dos 12 meses
Referência: Ministério da Saúde – Guia Alimentar para Crianças Brasileiras Menores de 2 Anos (2019); SBP
Observações: Evitar liquidificar/peneirar; evoluir a textura sem atrasar'),
('MET-002', 'metodos_alimentacao', 'BLW (Baby-Led Weaning)', NULL, NULL, NULL, 'Método: BLW (Baby-Led Weaning)
Como funciona: Bebê se alimenta sozinho com as mãos desde os 6 meses, com alimentos em tiras e formatos seguros; sem papinhas
Referência: Gill Rapley e Tracey Murkett
Observações: Requer sinais de prontidão: sentar com pouco apoio, controle de cabeça, interesse, perda do reflexo de protrusão'),
('MET-003', 'metodos_alimentacao', 'BLISS (Baby-Led Introduction to SolidS)', NULL, NULL, NULL, 'Método: BLISS (Baby-Led Introduction to SolidS)
Como funciona: Variação do BLW com 3 cuidados: 1 alimento rico em ferro, 1 energético e 1 fruta/legume em cada refeição; atenção a formatos de risco
Referência: Estudo BLISS – Universidade de Otago (Nova Zelândia)
Observações: Responde a preocupações sobre ferro e engasgo no BLW'),
('MET-004', 'metodos_alimentacao', 'Participativa / mista', NULL, NULL, NULL, 'Método: Participativa / mista
Como funciona: Combina colher oferecida pelo adulto com alimentos para pegar com as mãos, respeitando os sinais de fome e saciedade
Referência: Prática difundida no Brasil; alinhada ao Guia MS
Observações: Flexível e adequada a diferentes rotinas (ex.: creche + casa)'),
('MET-005', 'metodos_alimentacao', 'Alimentação responsiva (princípio para todos)', NULL, NULL, NULL, 'Método: Alimentação responsiva (princípio para todos)
Como funciona: O adulto decide o que, quando e onde; a criança decide quanto e se come
Referência: Ellyn Satter (Divisão de Responsabilidades); OMS
Observações: Não forçar, não premiar nem castigar com comida'),
('SON-001', 'rotinas_sono', 'Livre demanda (sem horário)', 0, 1, NULL, 'Faixa: Recém-nascido
Idade mín. (meses): 0
Idade máx. (meses): 1,5
Modelo de rotina: Livre demanda (sem horário)
Para quem costuma funcionar: Primeiras semanas; família se adaptando
Nº de cochilos: 4–6+ irregulares
Janela de vigília (aprox.): 45–60 min
Duração dos cochilos: 20 min a 3 h
Acordar (exemplo): Variável
Cochilos (exemplo): Dorme entre mamadas, sem horário fixo
Dormir (exemplo): Variável (sono noturno ainda não consolidado)
Sono total 24h (referência): 14–17 h (NSF)
Sinais para ajustar: Bebê muito sonolento para mamar ou choro inconsolável → falar com pediatra
Observações / flexibilidade: Não existe rotina nesta fase; foco em alimentação, luz natural de dia e penumbra à noite'),
('SON-002', 'rotinas_sono', 'Sono de contato + berço alternado', 0, 1, NULL, 'Faixa: Recém-nascido
Idade mín. (meses): 0
Idade máx. (meses): 1,5
Modelo de rotina: Sono de contato + berço alternado
Para quem costuma funcionar: Bebês que só dormem no colo; famílias com rede de apoio para revezar
Nº de cochilos: 4–6+
Janela de vigília (aprox.): 45–60 min
Duração dos cochilos: Curtos no berço, longos no colo
Acordar (exemplo): Variável
Cochilos (exemplo): Alternar cochilos no colo/sling com tentativas no berço
Dormir (exemplo): Variável
Sono total 24h (referência): 14–17 h
Sinais para ajustar: Cuidador exausto → organizar revezamento
Observações / flexibilidade: Cochilos de contato são normais e não ''viciam''; sono de contato só com adulto acordado'),
('SON-003', 'rotinas_sono', 'Ritmo por sinais de sono', 1, 3, NULL, 'Faixa: 6–12 semanas
Idade mín. (meses): 1,5
Idade máx. (meses): 3
Modelo de rotina: Ritmo por sinais de sono
Para quem costuma funcionar: Famílias que preferem seguir o bebê
Nº de cochilos: 4–5
Janela de vigília (aprox.): 60–90 min
Duração dos cochilos: 30 min a 2 h
Acordar (exemplo): 6h–8h
Cochilos (exemplo): A cada 60–90 min de vigília, observar bocejo, olhar parado, esfregar olhos
Dormir (exemplo): 20h–23h
Sono total 24h (referência): 14–17 h
Sinais para ajustar: Muitos despertares curtos à tarde → encurtar janelas
Observações / flexibilidade: Primeiros sinais de ciclo dia/noite; exposição à luz de manhã ajuda'),
('SON-004', 'rotinas_sono', 'Âncora matinal fixa', 1, 3, NULL, 'Faixa: 6–12 semanas
Idade mín. (meses): 1,5
Idade máx. (meses): 3
Modelo de rotina: Âncora matinal fixa
Para quem costuma funcionar: Famílias que querem previsibilidade gradual
Nº de cochilos: 4–5
Janela de vigília (aprox.): 60–90 min
Duração dos cochilos: Variável
Acordar (exemplo): Horário fixo (ex.: 7h)
Cochilos (exemplo): Livres ao longo do dia
Dormir (exemplo): Variável
Sono total 24h (referência): 14–17 h
Observações / flexibilidade: Fixar só o primeiro horário do dia é uma forma suave de começar a organizar o ritmo'),
('SON-005', 'rotinas_sono', '4 cochilos por janela de vigília', 3, 5, NULL, 'Faixa: 3–4 meses
Idade mín. (meses): 3
Idade máx. (meses): 5
Modelo de rotina: 4 cochilos por janela de vigília
Para quem costuma funcionar: Famílias em casa com flexibilidade
Nº de cochilos: 4
Janela de vigília (aprox.): 75–120 min
Duração dos cochilos: 30–90 min
Acordar (exemplo): 7h
Cochilos (exemplo): 8h45 · 11h15 · 13h45 · 16h15 (curto)
Dormir (exemplo): 19h–20h
Sono total 24h (referência): 12–16 h (AASM 4–12m)
Sinais para ajustar: Regressão/fase dos 4 meses: sono muda de padrão, despertares aumentam
Observações / flexibilidade: Cochilos curtos (30–45 min) são comuns e normais nesta idade'),
('SON-006', 'rotinas_sono', '3 cochilos + cochilo de ponte em movimento', 3, 5, NULL, 'Faixa: 3–4 meses
Idade mín. (meses): 3
Idade máx. (meses): 5
Modelo de rotina: 3 cochilos + cochilo de ponte em movimento
Para quem costuma funcionar: Famílias com irmãos mais velhos ou compromissos à tarde
Nº de cochilos: 3 + 1 curto
Janela de vigília (aprox.): 90–120 min
Duração dos cochilos: 45 min a 2 h
Acordar (exemplo): 7h
Cochilos (exemplo): 9h · 12h · 15h · 17h30 (curto, no carrinho/sling)
Dormir (exemplo): 19h30–20h30
Sono total 24h (referência): 12–16 h
Sinais para ajustar: Bebê muito cansado no fim do dia → antecipar o sono noturno
Observações / flexibilidade: Cochilo curto em movimento evita janela longa demais antes da noite'),
('SON-007', 'rotinas_sono', 'Cochilos de contato / sling', 3, 5, NULL, 'Faixa: 3–4 meses
Idade mín. (meses): 3
Idade máx. (meses): 5
Modelo de rotina: Cochilos de contato / sling
Para quem costuma funcionar: Bebês de alta demanda; pais que trabalham em casa com o bebê
Nº de cochilos: 4
Janela de vigília (aprox.): 75–120 min
Duração dos cochilos: Mais longos no sling
Acordar (exemplo): Variável
Cochilos (exemplo): Cochilos no sling durante tarefas
Dormir (exemplo): 19h–21h
Sono total 24h (referência): 12–16 h
Observações / flexibilidade: Seguir regras de segurança do sling (ver aba 5)'),
('SON-008', 'rotinas_sono', '3 cochilos por janela', 5, 7, NULL, 'Faixa: 5–6 meses
Idade mín. (meses): 5
Idade máx. (meses): 7
Modelo de rotina: 3 cochilos por janela
Para quem costuma funcionar: Famílias com flexibilidade
Nº de cochilos: 3
Janela de vigília (aprox.): 2–2,5 h
Duração dos cochilos: 1–2 h (1º e 2º); 30–45 min (3º)
Acordar (exemplo): 7h
Cochilos (exemplo): 9h · 12h30 · 16h (curto)
Dormir (exemplo): 19h–19h30
Sono total 24h (referência): 12–16 h
Sinais para ajustar: Resistência ao 3º cochilo → pode estar pronto para esticar janelas
Observações / flexibilidade: Janelas crescem ao longo do dia (menor pela manhã, maior à noite)'),
('SON-009', 'rotinas_sono', '3 cochilos por relógio (horários fixos)', 5, 7, NULL, 'Faixa: 5–6 meses
Idade mín. (meses): 5
Idade máx. (meses): 7
Modelo de rotina: 3 cochilos por relógio (horários fixos)
Para quem costuma funcionar: Famílias que preferem horários previsíveis, pais com horário de trabalho fixo
Nº de cochilos: 3
Janela de vigília (aprox.): \~2–2,5 h
Duração dos cochilos: Variável
Acordar (exemplo): 7h
Cochilos (exemplo): 9h · 12h · 15h30
Dormir (exemplo): 19h
Sono total 24h (referência): 12–16 h
Sinais para ajustar: Bebê acorda antes do horário previsto com frequência → reavaliar
Observações / flexibilidade: Relógio fixo facilita a vida de cuidadores diferentes (avós, babá)'),
('SON-010', 'rotinas_sono', 'Rotina ''tarde'' (família que dorme mais tarde)', 5, 7, NULL, 'Faixa: 5–6 meses
Idade mín. (meses): 5
Idade máx. (meses): 7
Modelo de rotina: Rotina ''tarde'' (família que dorme mais tarde)
Para quem costuma funcionar: Famílias com pais que chegam do trabalho às 19h–20h
Nº de cochilos: 3
Janela de vigília (aprox.): 2–2,5 h
Duração dos cochilos: Variável
Acordar (exemplo): 8h30–9h
Cochilos (exemplo): 10h30 · 14h · 17h30
Dormir (exemplo): 21h–21h30
Sono total 24h (referência): 12–16 h
Sinais para ajustar: Bebê acordando cansado ou muito irritado à noite → antecipar
Observações / flexibilidade: Dormir tarde é cultural e pode funcionar se o bebê acorda mais tarde e soma sono suficiente'),
('SON-011', 'rotinas_sono', 'Transição de 3 para 2 cochilos', 7, 9, NULL, 'Faixa: 7–8 meses
Idade mín. (meses): 7
Idade máx. (meses): 9
Modelo de rotina: Transição de 3 para 2 cochilos
Para quem costuma funcionar: Bebês que resistem ao 3º cochilo
Nº de cochilos: 2–3
Janela de vigília (aprox.): 2,5–3,5 h
Duração dos cochilos: 1–1,5 h
Acordar (exemplo): 7h
Cochilos (exemplo): Dias alternando: 9h30 · 13h30 (+ 16h30 curto quando preciso)
Dormir (exemplo): 18h30–19h30
Sono total 24h (referência): 12–16 h
Sinais para ajustar: Hora de dormir difícil ou despertar às 5h → ajustar
Observações / flexibilidade: Transição leva 2–4 semanas; antecipar a noite nos dias de 2 cochilos'),
('SON-012', 'rotinas_sono', '2 cochilos', 7, 9, NULL, 'Faixa: 7–8 meses
Idade mín. (meses): 7
Idade máx. (meses): 9
Modelo de rotina: 2 cochilos
Para quem costuma funcionar: Bebês que já consolidaram
Nº de cochilos: 2
Janela de vigília (aprox.): 2,5–3,5 h
Duração dos cochilos: 1–2 h cada
Acordar (exemplo): 7h
Cochilos (exemplo): 9h45 · 14h
Dormir (exemplo): 19h
Sono total 24h (referência): 12–16 h
Observações / flexibilidade: Nesta fase podem surgir ansiedade de separação e novos marcos motores que agitam o sono'),
('SON-013', 'rotinas_sono', '2 cochilos clássicos', 9, 12, NULL, 'Faixa: 9–12 meses
Idade mín. (meses): 9
Idade máx. (meses): 12
Modelo de rotina: 2 cochilos clássicos
Para quem costuma funcionar: Maioria das famílias
Nº de cochilos: 2
Janela de vigília (aprox.): 3–4 h
Duração dos cochilos: 1–1,5 h
Acordar (exemplo): 7h
Cochilos (exemplo): 10h · 14h30
Dormir (exemplo): 19h–19h30
Sono total 24h (referência): 12–16 h
Sinais para ajustar: Cochilo da tarde recusado repetidamente'),
('SON-014', 'rotinas_sono', '2 cochilos com família que dorme tarde', 9, 12, NULL, 'Faixa: 9–12 meses
Idade mín. (meses): 9
Idade máx. (meses): 12
Modelo de rotina: 2 cochilos com família que dorme tarde
Para quem costuma funcionar: Pais que trabalham até mais tarde
Nº de cochilos: 2
Janela de vigília (aprox.): 3–4 h
Duração dos cochilos: 1–1,5 h
Acordar (exemplo): 8h30
Cochilos (exemplo): 11h30 · 16h
Dormir (exemplo): 21h
Sono total 24h (referência): 12–16 h
Observações / flexibilidade: Funciona se o despertar também é mais tarde (creche/escola cedo dificulta)'),
('SON-015', 'rotinas_sono', 'Rotina de creche/berçário', 9, 12, NULL, 'Faixa: 9–12 meses
Idade mín. (meses): 9
Idade máx. (meses): 12
Modelo de rotina: Rotina de creche/berçário
Para quem costuma funcionar: Bebês em creche
Nº de cochilos: 2 (horários da creche)
Janela de vigília (aprox.): 3–4 h
Duração dos cochilos: Variável; costumam ser mais curtos na creche
Acordar (exemplo): 6h30
Cochilos (exemplo): Horários da creche (ex.: 9h30 · 13h)
Dormir (exemplo): 18h30–19h
Sono total 24h (referência): 12–16 h
Sinais para ajustar: Chega muito cansado → antecipar hora de dormir
Observações / flexibilidade: Conversar com a creche para alinhar rituais; cochilo de ponte no carro na volta é comum'),
('SON-016', 'rotinas_sono', 'Transição de 2 para 1 cochilo', 12, 18, NULL, 'Faixa: 13–18 meses
Idade mín. (meses): 12
Idade máx. (meses): 18
Modelo de rotina: Transição de 2 para 1 cochilo
Para quem costuma funcionar: Crianças que recusam o cochilo da manhã ou da tarde
Nº de cochilos: 1–2
Janela de vigília (aprox.): 4–6 h
Duração dos cochilos: 1,5–3 h (se 1 cochilo)
Acordar (exemplo): 7h
Cochilos (exemplo): Dias de 2 (10h e 15h) e dias de 1 (12h–12h30)
Dormir (exemplo): 18h30–19h30
Sono total 24h (referência): 11–14 h (AASM 1–2a)
Sinais para ajustar: Irritabilidade no fim da tarde → dormir mais cedo nos dias de 1 cochilo
Observações / flexibilidade: Transição média entre 13 e 18 meses; não há pressa'),
('SON-017', 'rotinas_sono', '1 cochilo pós-almoço', 12, 18, NULL, 'Faixa: 13–18 meses
Idade mín. (meses): 12
Idade máx. (meses): 18
Modelo de rotina: 1 cochilo pós-almoço
Para quem costuma funcionar: Crianças que já consolidaram
Nº de cochilos: 1
Janela de vigília (aprox.): 5–6 h
Duração dos cochilos: 1,5–3 h
Acordar (exemplo): 7h
Cochilos (exemplo): 12h30–15h
Dormir (exemplo): 19h30–20h
Sono total 24h (referência): 11–14 h'),
('SON-018', 'rotinas_sono', '1 cochilo', 18, 24, NULL, 'Faixa: 18–24 meses
Idade mín. (meses): 18
Idade máx. (meses): 24
Modelo de rotina: 1 cochilo
Para quem costuma funcionar: Maioria
Nº de cochilos: 1
Janela de vigília (aprox.): 5–6 h
Duração dos cochilos: 1,5–2,5 h
Acordar (exemplo): 7h
Cochilos (exemplo): 12h30–14h30
Dormir (exemplo): 19h30–20h30
Sono total 24h (referência): 11–14 h
Sinais para ajustar: Demora muito para adormecer à noite → encurtar ou antecipar o cochilo
Observações / flexibilidade: Fase de testar limites e protestar na hora de dormir é comum'),
('SON-019', 'rotinas_sono', 'Cochilo em movimento (carro/carrinho)', 18, 24, NULL, 'Faixa: 18–24 meses
Idade mín. (meses): 18
Idade máx. (meses): 24
Modelo de rotina: Cochilo em movimento (carro/carrinho)
Para quem costuma funcionar: Famílias com rotinas externas
Nº de cochilos: 1
Janela de vigília (aprox.): 5–6 h
Duração dos cochilos: 1–2 h
Acordar (exemplo): 7h
Cochilos (exemplo): Cochilo no carrinho durante passeio ou trajeto
Dormir (exemplo): 19h30–20h30
Sono total 24h (referência): 11–14 h
Observações / flexibilidade: Válido se a criança descansa bem; carrinho sempre reclinado e com cinto'),
('SON-020', 'rotinas_sono', '1 cochilo', 24, 36, NULL, 'Faixa: 2–3 anos
Idade mín. (meses): 24
Idade máx. (meses): 36
Modelo de rotina: 1 cochilo
Para quem costuma funcionar: Maioria
Nº de cochilos: 1
Janela de vigília (aprox.): 5–7 h
Duração dos cochilos: 1–2 h
Acordar (exemplo): 7h
Cochilos (exemplo): 13h–14h30
Dormir (exemplo): 20h
Sono total 24h (referência): 10–13 h (AASM 3–5a) / 11–14 h (1–2a)
Sinais para ajustar: Dificuldade de dormir à noite'),
('SON-021', 'rotinas_sono', 'Descanso tranquilo sem sono', 24, 36, NULL, 'Faixa: 2–3 anos
Idade mín. (meses): 24
Idade máx. (meses): 36
Modelo de rotina: Descanso tranquilo sem sono
Para quem costuma funcionar: Crianças que param de cochilar mais cedo
Nº de cochilos: 0 (descanso de 30–60 min)
Janela de vigília (aprox.): Dia todo
Acordar (exemplo): 7h
Cochilos (exemplo): Momento quieto com livros no quarto
Dormir (exemplo): 19h–19h30
Sono total 24h (referência): 10–13 h
Sinais para ajustar: Irritação no fim do dia → antecipar a noite
Observações / flexibilidade: Parar o cochilo entre 2,5 e 5 anos é normal'),
('SON-022', 'rotinas_sono', 'Cochilo opcional', 36, 60, NULL, 'Faixa: 3–5 anos
Idade mín. (meses): 36
Idade máx. (meses): 60
Modelo de rotina: Cochilo opcional
Para quem costuma funcionar: Pré-escolares
Nº de cochilos: 0–1
Duração dos cochilos: Até 1,5 h (se houver)
Acordar (exemplo): 7h
Cochilos (exemplo): Cochilo após o almoço em dias mais cansativos
Dormir (exemplo): 19h30–20h30
Sono total 24h (referência): 10–13 h
Sinais para ajustar: Cochilo atrasa muito o sono noturno → encurtar
Observações / flexibilidade: Na escola o cochilo pode continuar mesmo que em casa não aconteça'),
('SON-023', 'rotinas_sono', 'Sem cochilo, noite antecipada', 36, 60, NULL, 'Faixa: 3–5 anos
Idade mín. (meses): 36
Idade máx. (meses): 60
Modelo de rotina: Sem cochilo, noite antecipada
Para quem costuma funcionar: Crianças que não dormem mais de dia
Nº de cochilos: 0
Acordar (exemplo): 7h
Dormir (exemplo): 19h–19h30
Sono total 24h (referência): 10–13 h
Observações / flexibilidade: Dormir mais cedo compensa a ausência do cochilo'),
('DOR-001', 'formas_de_dormir', 'Ninar no colo (embalo)', 0, 24, NULL, 'Método: Ninar no colo (embalo)
Categoria: Contato e movimento
Idade mín. (meses): 0
Idade máx. (meses): 24
Faixa etária: 0m–2a
Como fazer: Segurar o bebê junto ao peito e balançar suavemente, cantando ou fazendo ''shhh''
Quando funciona melhor: Recém-nascidos e momentos de choro ou superestímulo
Vantagens: Vínculo; regula o sistema nervoso
Pontos de atenção: Pode ficar cansativo para bebês mais pesados
Segurança: Após adormecer, colocar no berço de barriga para cima
Transição (se a família quiser mudar): Diminuir o balanço aos poucos e colocar no berço mais acordado'),
('DOR-002', 'formas_de_dormir', 'Ninar em pé com balanço lateral', 0, 18, NULL, 'Método: Ninar em pé com balanço lateral
Categoria: Contato e movimento
Idade mín. (meses): 0
Idade máx. (meses): 18
Faixa etária: 0m–1a6m
Como fazer: Em pé, com o bebê no colo, fazer movimento ritmado de um lado para o outro ou pequenos agachamentos
Quando funciona melhor: Cólicas e fim de tarde agitado
Vantagens: Ritmo lembra o útero
Pontos de atenção: Cansaço do adulto
Segurança: Não sacudir nunca
Transição (se a família quiser mudar): Trocar por balanço mais lento e depois apenas colo parado'),
('DOR-003', 'formas_de_dormir', 'Rede', 0, 36, NULL, 'Método: Rede
Categoria: Movimento
Idade mín. (meses): 0
Idade máx. (meses): 36
Faixa etária: 0m–3a
Como fazer: Embalar o bebê na rede com adulto sentado ao lado ou deitado junto acordado
Quando funciona melhor: Famílias com tradição de rede; calor
Vantagens: Movimento contínuo acalma; cultural em várias regiões
Pontos de atenção: Posição curvada pode dobrar o queixo sobre o peito
Segurança: Não é um local seguro para o bebê dormir sozinho e sem supervisão: após adormecer, transferir para berço plano e firme, de barriga para cima
Transição (se a família quiser mudar): Embalar até sonolento e transferir para o berço'),
('DOR-004', 'formas_de_dormir', 'Sling de argola', 0, 24, NULL, 'Método: Sling de argola
Categoria: Contato (carregamento)
Idade mín. (meses): 0
Idade máx. (meses): 24
Faixa etária: 0m–2a
Como fazer: Bebê em posição vertical, ''coladinho'' no adulto, rosto visível e alto o suficiente para ser beijado
Quando funciona melhor: Cochilos durante tarefas; bebês que só dormem no colo
Vantagens: Mãos livres; bebê escuta o coração
Pontos de atenção: Distribui peso em um ombro
Segurança: Regra T.I.C.K.S.: firme, rosto visível, perto o suficiente para beijar, queixo afastado do peito, costas apoiadas
Transição (se a família quiser mudar): Usar para cochilos e ir alternando com berço'),
('DOR-005', 'formas_de_dormir', 'Wrap / sling de tecido', 0, 18, NULL, 'Método: Wrap / sling de tecido
Categoria: Contato (carregamento)
Idade mín. (meses): 0
Idade máx. (meses): 18
Faixa etária: 0m–1a6m
Como fazer: Amarração envolvendo o bebê junto ao peito
Quando funciona melhor: Recém-nascidos; saídas
Vantagens: Distribui bem o peso
Pontos de atenção: Curva de aprendizagem para amarrar
Segurança: Mesma regra T.I.C.K.S.; nariz e boca sempre livres
Transição (se a família quiser mudar): Cochilos no wrap + tentativas no berço'),
('DOR-006', 'formas_de_dormir', 'Carregador ergonômico (tipo Ergobaby)', 0, 36, NULL, 'Método: Carregador ergonômico (tipo Ergobaby)
Categoria: Contato (carregamento)
Idade mín. (meses): 0
Idade máx. (meses): 36
Faixa etária: 0m–3a
Como fazer: Bebê de frente para o adulto, posição em ''M'' (joelhos acima do bumbum)
Quando funciona melhor: Passeios; cochilos em movimento; bebês mais pesados
Vantagens: Conforto para o adulto por mais tempo
Pontos de atenção: Conferir a faixa de peso/idade do modelo (alguns exigem inserto para recém-nascido)
Segurança: Rosto visível; não virar o bebê para frente enquanto dorme
Transição (se a família quiser mudar): Cochilo no carregador e transferência quando bem adormecido'),
('DOR-007', 'formas_de_dormir', 'Amamentar até dormir', 0, 36, NULL, 'Método: Amamentar até dormir
Categoria: Alimentação
Idade mín. (meses): 0
Idade máx. (meses): 36
Faixa etária: 0m–3a
Como fazer: Oferecer o peito no ritual de sono
Quando funciona melhor: Muito eficiente em todas as idades; noites e despertares
Vantagens: Conforto, nutrição e hormônios que induzem sono
Pontos de atenção: Se o cuidador quiser mudar, exige transição gradual
Segurança: Se adormecer na cama do adulto, seguir cuidados de cama compartilhada
Transição (se a família quiser mudar): Encerrar a mamada antes do sono profundo e ninar de outra forma, aos poucos'),
('DOR-008', 'formas_de_dormir', 'Mamadeira no ritual de sono', 0, 24, NULL, 'Método: Mamadeira no ritual de sono
Categoria: Alimentação
Idade mín. (meses): 0
Idade máx. (meses): 24
Faixa etária: 0m–2a
Como fazer: Oferecer mamadeira no colo antes de deitar
Quando funciona melhor: Bebês em fórmula ou leite ordenhado
Vantagens: Outros cuidadores podem fazer
Pontos de atenção: Adormecer com mamadeira na boca aumenta risco de cárie após os dentes
Segurança: Nunca deixar mamadeira apoiada ou no berço
Transição (se a família quiser mudar): Oferecer antes da escovação e do ritual final'),
('DOR-009', 'formas_de_dormir', 'Berço com presença (mão na barriga, ''shhh'')', 3, 36, NULL, 'Método: Berço com presença (mão na barriga, ''shhh'')
Categoria: Presença
Idade mín. (meses): 3
Idade máx. (meses): 36
Faixa etária: 3m–3a
Como fazer: Deitar o bebê sonolento e ficar ao lado com a mão no peito ou barriga e sons suaves
Quando funciona melhor: Bebês que aceitam o berço mas precisam de apoio
Vantagens: Autonomia gradual com segurança emocional
Pontos de atenção: Pode levar mais tempo no início
Segurança: Berço sem protetores, travesseiros ou bichos (até 12m)
Transição (se a família quiser mudar): Retirar o toque aos poucos e depois se afastar'),
('DOR-010', 'formas_de_dormir', 'Cadeira ao lado (fading)', 6, 72, NULL, 'Método: Cadeira ao lado (fading)
Categoria: Presença / autonomia gradual
Idade mín. (meses): 6
Idade máx. (meses): 72
Faixa etária: 6m+
Como fazer: Adulto sentado ao lado do berço/cama; a cada poucas noites, a cadeira se afasta até a porta
Quando funciona melhor: Famílias que querem mais autonomia sem deixar chorar sozinho
Vantagens: Gradual e respeitoso
Pontos de atenção: Leva semanas; exige consistência
Transição (se a família quiser mudar): É por si só uma transição'),
('DOR-011', 'formas_de_dormir', 'Pegar e colocar (pick up / put down)', 4, 12, NULL, 'Método: Pegar e colocar (pick up / put down)
Categoria: Presença / autonomia gradual
Idade mín. (meses): 4
Idade máx. (meses): 12
Faixa etária: 4m–1a
Como fazer: Se chorar, pegar até acalmar e colocar de volta acordado; repetir
Quando funciona melhor: Bebês que se acalmam rapidamente no colo
Vantagens: Resposta ao choro
Pontos de atenção: Pode estimular bebês mais velhos'),
('DOR-012', 'formas_de_dormir', 'Deitar sonolento, mas acordado', 3, 72, NULL, 'Método: Deitar sonolento, mas acordado
Categoria: Autonomia
Idade mín. (meses): 3
Idade máx. (meses): 72
Faixa etária: 3m+
Como fazer: Colocar no berço no fim do ritual, ainda acordado, com presença do adulto
Quando funciona melhor: Quando a família deseja que o bebê adormeça no berço
Vantagens: Facilita reconectar ciclos de sono
Pontos de atenção: Nem todo bebê aceita; não é obrigatório
Segurança: Berço seguro
Transição (se a família quiser mudar): Praticar primeiro no sono noturno'),
('DOR-013', 'formas_de_dormir', 'Berço acoplado (side-car)', 0, 12, NULL, 'Método: Berço acoplado (side-car)
Categoria: Ambiente
Idade mín. (meses): 0
Idade máx. (meses): 12
Faixa etária: 0m–1a
Como fazer: Berço preso lateralmente na cama dos pais, no mesmo nível
Quando funciona melhor: Mamadas noturnas frequentes
Vantagens: Proximidade com superfície separada
Pontos de atenção: Deve estar bem fixo, sem vão entre os colchões
Segurança: Superfície própria, plana e firme
Transição (se a família quiser mudar): Afastar o berço aos poucos'),
('DOR-014', 'formas_de_dormir', 'Cama compartilhada', 0, 72, NULL, 'Método: Cama compartilhada
Categoria: Ambiente
Idade mín. (meses): 0
Idade máx. (meses): 72
Faixa etária: 0m+
Como fazer: Bebê dorme na cama dos pais
Quando funciona melhor: Escolha de muitas famílias, especialmente com amamentação
Vantagens: Proximidade; facilita amamentar
Pontos de atenção: SBP e AAP recomendam dividir o quarto, mas não a cama, principalmente nos primeiros meses
Segurança: Se escolhida: colchão firme, sem travesseiros/edredons perto do bebê, bebê de barriga para cima, adultos sem álcool, sedativos ou fumo; NUNCA em sofá ou poltrona
Transição (se a família quiser mudar): Berço acoplado como passo intermediário'),
('DOR-015', 'formas_de_dormir', 'Charutinho (swaddle)', 0, 3, NULL, 'Método: Charutinho (swaddle)
Categoria: Ambiente
Idade mín. (meses): 0
Idade máx. (meses): 3
Faixa etária: 0m–3m
Como fazer: Envolver o bebê em manta leve, braços contidos e quadris soltos
Quando funciona melhor: Recém-nascidos com reflexo de susto
Vantagens: Reduz reflexo de Moro
Pontos de atenção: Parar ao primeiro sinal de rolar (geralmente 2–4 meses)
Segurança: Sempre de barriga para cima; quadril solto; não superaquecer
Transição (se a família quiser mudar): Liberar um braço de cada vez; depois saco de dormir'),
('DOR-016', 'formas_de_dormir', 'Ruído branco', 0, 72, NULL, 'Método: Ruído branco
Categoria: Ambiente
Idade mín. (meses): 0
Idade máx. (meses): 72
Faixa etária: 0m+
Como fazer: Som contínuo e baixo (ventilador, aplicativo) durante o sono
Quando funciona melhor: Casas barulhentas; irmãos
Vantagens: Mascara ruídos
Pontos de atenção: Volume baixo e distante do bebê
Segurança: Aparelho a distância segura, volume moderado
Transição (se a família quiser mudar): Diminuir o volume aos poucos'),
('DOR-017', 'formas_de_dormir', 'Quarto escuro / penumbra', 0, 72, NULL, 'Método: Quarto escuro / penumbra
Categoria: Ambiente
Idade mín. (meses): 0
Idade máx. (meses): 72
Faixa etária: 0m+
Como fazer: Blackout ou penumbra nos cochilos e à noite; luz âmbar suave para mamadas
Quando funciona melhor: A partir de 2–3 meses, especialmente cochilos
Vantagens: Favorece melatonina
Pontos de atenção: Luz de tela atrapalha'),
('DOR-018', 'formas_de_dormir', 'Canção de ninar', 0, 72, NULL, 'Método: Canção de ninar
Categoria: Ritual
Idade mín. (meses): 0
Idade máx. (meses): 72
Faixa etária: 0m+
Como fazer: Mesma música todas as noites, cantada baixo
Quando funciona melhor: Qualquer idade
Vantagens: Sinal previsível de sono
Transição (se a família quiser mudar): A canção passa a ser o ''sinal'' mesmo com outro cuidador'),
('DOR-019', 'formas_de_dormir', 'Banho morno relaxante', 0, 72, NULL, 'Método: Banho morno relaxante
Categoria: Ritual
Idade mín. (meses): 0
Idade máx. (meses): 72
Faixa etária: 0m+
Como fazer: Banho curto e morno no início do ritual
Quando funciona melhor: Bebês que relaxam no banho
Vantagens: Transição do dia para a noite
Pontos de atenção: Alguns bebês ficam agitados após o banho; nesse caso, mudar o horário
Segurança: Temperatura em torno de 36–37 °C; nunca sozinho'),
('DOR-020', 'formas_de_dormir', 'Massagem (Shantala)', 1, 36, NULL, 'Método: Massagem (Shantala)
Categoria: Ritual / toque
Idade mín. (meses): 1
Idade máx. (meses): 36
Faixa etária: 1m–3a
Como fazer: Massagem com óleo vegetal sem perfume após o banho
Quando funciona melhor: Bebês agitados; cólicas
Vantagens: Relaxamento; vínculo
Pontos de atenção: Evitar logo após mamar
Segurança: Óleo vegetal puro; teste de sensibilidade'),
('DOR-021', 'formas_de_dormir', 'Chupeta', 0, 36, NULL, 'Método: Chupeta
Categoria: Sucção
Idade mín. (meses): 0
Idade máx. (meses): 36
Faixa etária: 0m–3a
Como fazer: Oferecer ao deitar (se a família optar)
Quando funciona melhor: Bebês com grande necessidade de sucção
Vantagens: Associada a menor risco de morte súbita no sono
Pontos de atenção: Aguardar amamentação bem estabelecida; uso prolongado pode afetar dentes e fala
Segurança: Não amarrar em cordão no pescoço; não adoçar
Transição (se a família quiser mudar): Retirar gradualmente entre 2 e 3 anos'),
('DOR-022', 'formas_de_dormir', 'Objeto de transição (paninho, naninha)', 12, 72, NULL, 'Método: Objeto de transição (paninho, naninha)
Categoria: Conforto
Idade mín. (meses): 12
Idade máx. (meses): 72
Faixa etária: 1a+
Como fazer: Oferecer um paninho ou bichinho que acompanha o ritual
Quando funciona melhor: A partir de 12 meses
Vantagens: Ajuda na separação
Segurança: Não colocar objetos no berço antes de 12 meses'),
('DOR-023', 'formas_de_dormir', 'Leitura de livros no ritual', 6, 72, NULL, 'Método: Leitura de livros no ritual
Categoria: Ritual
Idade mín. (meses): 6
Idade máx. (meses): 72
Faixa etária: 6m+
Como fazer: 2–3 livros curtos, sempre os mesmos passos
Quando funciona melhor: A partir de 6m
Vantagens: Linguagem e previsibilidade
Pontos de atenção: Limitar quantidade para não prolongar'),
('DOR-024', 'formas_de_dormir', 'Carrinho em movimento', 0, 36, NULL, 'Método: Carrinho em movimento
Categoria: Movimento
Idade mín. (meses): 0
Idade máx. (meses): 36
Faixa etária: 0m–3a
Como fazer: Passear com o carrinho no horário do cochilo
Quando funciona melhor: Cochilos fora de casa; bebês que resistem
Vantagens: Ar livre e movimento
Pontos de atenção: Cochilos podem ser mais curtos
Segurança: Encosto reclinado adequado à idade; cinto; nunca cobrir o carrinho com pano (superaquece)'),
('DOR-025', 'formas_de_dormir', 'Cochilo no carro', 0, 72, NULL, 'Método: Cochilo no carro
Categoria: Movimento
Idade mín. (meses): 0
Idade máx. (meses): 72
Faixa etária: 0m+
Como fazer: Aproveitar trajetos no horário do cochilo
Quando funciona melhor: Rotinas com deslocamento
Vantagens: Prático
Pontos de atenção: Não deixar dormir na cadeirinha fora do carro por longos períodos
Segurança: Nunca deixar a criança sozinha no carro'),
('DOR-026', 'formas_de_dormir', 'Bola de pilates (quicar suave)', 0, 12, NULL, 'Método: Bola de pilates (quicar suave)
Categoria: Movimento
Idade mín. (meses): 0
Idade máx. (meses): 12
Faixa etária: 0m–1a
Como fazer: Adulto sentado na bola quica levemente com o bebê no colo
Quando funciona melhor: Cólica; fim de tarde
Vantagens: Ritmo que acalma e poupa as costas do adulto
Segurança: Segurar firme'),
('DOR-027', 'formas_de_dormir', 'Tapinhas ritmados no bumbum/costas', 0, 24, NULL, 'Método: Tapinhas ritmados no bumbum/costas
Categoria: Toque
Idade mín. (meses): 0
Idade máx. (meses): 24
Faixa etária: 0m–2a
Como fazer: Tapinhas lentos e ritmados no bumbum com o bebê de lado no colo ou deitado
Quando funciona melhor: Qualquer momento
Vantagens: Regulação pelo ritmo
Segurança: Deitar sempre de barriga para cima para dormir
Transição (se a família quiser mudar): Reduzir a intensidade até só a mão parada'),
('DOR-028', 'formas_de_dormir', 'Pele a pele', 0, 3, NULL, 'Método: Pele a pele
Categoria: Contato
Idade mín. (meses): 0
Idade máx. (meses): 3
Faixa etária: 0m–3m
Como fazer: Bebê só de fralda no peito nu do adulto
Quando funciona melhor: Recém-nascidos e prematuros
Vantagens: Regula temperatura, respiração e choro
Pontos de atenção: Adulto precisa estar acordado
Segurança: Não adormecer com o bebê em cima do peito em sofá'),
('DOR-029', 'formas_de_dormir', 'Outro cuidador faz o ritual', 4, 72, NULL, 'Método: Outro cuidador faz o ritual
Categoria: Ritual
Idade mín. (meses): 4
Idade máx. (meses): 72
Faixa etária: 4m+
Como fazer: Pai, mãe ou outro cuidador faz o ritual algumas noites
Quando funciona melhor: Quando a mãe está exausta ou para diversificar
Vantagens: Divide a carga; bebê aprende várias formas
Pontos de atenção: Adaptação de alguns dias'),
('DOR-030', 'formas_de_dormir', 'Cama no chão (floor bed, Montessori)', 6, 72, NULL, 'Método: Cama no chão (floor bed, Montessori)
Categoria: Ambiente / autonomia
Idade mín. (meses): 6
Idade máx. (meses): 72
Faixa etária: 6m+
Como fazer: Colchão firme direto no chão em quarto totalmente seguro
Quando funciona melhor: Famílias montessorianas
Vantagens: Autonomia para entrar e sair
Pontos de atenção: Exige quarto 100% à prova de bebê
Segurança: Quarto seguro: tomadas, móveis fixos, sem cordões'),
('DES-001', 'desenvolvimento', 'Motor grosso', 0, 6, NULL, 'Área: Motor grosso
Idade mín. (meses): 0
Idade máx. (meses): 6
Faixa etária: 0m–6m
Abordagem: Pikler
Dica / atividade: Deixar o bebê de barriga para cima em superfície firme e livre, com liberdade total de movimento
Por que funciona: Ele descobre sozinho virar, rolar e se arrastar, com segurança e confiança no próprio corpo
Materiais: Tapete firme, manta
O que evitar (segundo a abordagem): Posicionar em cadeirinhas por longos períodos'),
('DES-002', 'desenvolvimento', 'Motor grosso', 3, 12, NULL, 'Área: Motor grosso
Idade mín. (meses): 3
Idade máx. (meses): 12
Faixa etária: 3m–1a
Abordagem: Pikler
Dica / atividade: Não colocar sentado nem em pé antes que o bebê chegue sozinho a essas posições
Por que funciona: Cada posição conquistada pelo próprio bebê vem com equilíbrio e força adequados
Materiais: Chão livre
O que evitar (segundo a abordagem): Andador, pular com o bebê em pé segurando as mãos por longos períodos
Quando conversar com o pediatra: Não senta sem apoio aos 9m → conversar com pediatra'),
('DES-003', 'desenvolvimento', 'Motor grosso', 0, 6, NULL, 'Área: Motor grosso
Idade mín. (meses): 0
Idade máx. (meses): 6
Faixa etária: 0m–6m
Abordagem: Neurociência / SBP
Dica / atividade: Tummy time: bebê de bruços acordado várias vezes ao dia, começando com poucos minutos
Por que funciona: Fortalece pescoço, ombros e prepara para rolar e engatinhar
Materiais: Tapete, espelho, rolinho de toalha
O que evitar (segundo a abordagem): Deixar dormir de bruços
Quando conversar com o pediatra: Não sustenta a cabeça aos 4m → pediatra'),
('DES-004', 'desenvolvimento', 'Motor grosso', 6, 18, NULL, 'Área: Motor grosso
Idade mín. (meses): 6
Idade máx. (meses): 18
Faixa etária: 6m–1a6m
Abordagem: Pikler
Dica / atividade: Oferecer obstáculos baixos (almofada firme, rampa, degrau de madeira) para escalar
Por que funciona: Aprende a avaliar riscos e planejar movimentos
Materiais: Triângulo de Pikler, rampas, almofadas
O que evitar (segundo a abordagem): Ajudar excessivamente ou dizer ''cuidado'' o tempo todo'),
('DES-005', 'desenvolvimento', 'Motor grosso', 9, 18, NULL, 'Área: Motor grosso
Idade mín. (meses): 9
Idade máx. (meses): 18
Faixa etária: 9m–1a6m
Abordagem: Montessori
Dica / atividade: Barra fixa na parede junto ao espelho para o bebê se puxar para ficar em pé
Por que funciona: Apoio estável para treinar o ficar em pé com autonomia
Materiais: Barra de madeira, espelho
O que evitar (segundo a abordagem): Andador
Quando conversar com o pediatra: Não anda aos 18m → pediatra'),
('DES-006', 'desenvolvimento', 'Motor grosso', 12, 36, NULL, 'Área: Motor grosso
Idade mín. (meses): 12
Idade máx. (meses): 36
Faixa etária: 1a–3a
Abordagem: Brincar livre
Dica / atividade: Brincar ao ar livre todos os dias em terrenos variados (grama, areia, subidas)
Por que funciona: Terrenos irregulares desafiam equilíbrio e propriocepção
Materiais: Parque, quintal
O que evitar (segundo a abordagem): Superfícies sempre lisas e planas'),
('DES-007', 'desenvolvimento', 'Motor grosso', 24, 72, NULL, 'Área: Motor grosso
Idade mín. (meses): 24
Idade máx. (meses): 72
Faixa etária: 2a+
Abordagem: Brincar livre
Dica / atividade: Brincadeira bruta segura e jogos de corrida
Por que funciona: Desenvolve força, coordenação e regulação da força
Materiais: Colchão, espaço aberto
O que evitar (segundo a abordagem): Proibir todo movimento intenso'),
('DES-008', 'desenvolvimento', 'Motor fino', 0, 6, NULL, 'Área: Motor fino
Idade mín. (meses): 0
Idade máx. (meses): 6
Faixa etária: 0m–6m
Abordagem: Montessori
Dica / atividade: Móbiles visuais (Munari, Octaedro, Gobbi) e, depois, móbiles táteis para alcançar
Por que funciona: Estimulam foco visual e depois o alcance intencional
Materiais: Móbiles
O que evitar (segundo a abordagem): Móbiles com muitas cores e sons ao mesmo tempo'),
('DES-009', 'desenvolvimento', 'Motor fino', 3, 9, NULL, 'Área: Motor fino
Idade mín. (meses): 3
Idade máx. (meses): 9
Faixa etária: 3m–9m
Abordagem: Montessori
Dica / atividade: Oferecer chocalhos e argolas ao alcance da mão, para o bebê pegar sozinho
Por que funciona: Desenvolve a preensão voluntária
Materiais: Argolas, chocalhos de madeira
O que evitar (segundo a abordagem): Colocar o objeto diretamente na mão'),
('DES-010', 'desenvolvimento', 'Motor fino', 6, 18, NULL, 'Área: Motor fino
Idade mín. (meses): 6
Idade máx. (meses): 18
Faixa etária: 6m–1a6m
Abordagem: Brincar heurístico
Dica / atividade: Cesto dos tesouros com objetos do cotidiano
Por que funciona: Explorar formas, pesos e texturas refina a manipulação
Materiais: Cesto e objetos naturais
O que evitar (segundo a abordagem): Brinquedos eletrônicos que fazem tudo pelo bebê'),
('DES-011', 'desenvolvimento', 'Motor fino', 8, 18, NULL, 'Área: Motor fino
Idade mín. (meses): 8
Idade máx. (meses): 18
Faixa etária: 8m–1a6m
Abordagem: Montessori
Dica / atividade: Caixa de permanência do objeto (bola cai no furo e reaparece)
Por que funciona: Coordenação olho-mão e noção de permanência
Materiais: Caixa com furo e bola'),
('DES-012', 'desenvolvimento', 'Motor fino', 9, 24, NULL, 'Área: Motor fino
Idade mín. (meses): 9
Idade máx. (meses): 24
Faixa etária: 9m–2a
Abordagem: BLW / vida prática
Dica / atividade: Deixar o bebê comer com as mãos e depois com colher
Por que funciona: Pinça e coordenação se desenvolvem na alimentação
Materiais: Alimentos em tiras e pedaços
O que evitar (segundo a abordagem): Limpar o bebê a cada mordida'),
('DES-013', 'desenvolvimento', 'Motor fino', 18, 48, NULL, 'Área: Motor fino
Idade mín. (meses): 18
Idade máx. (meses): 48
Faixa etária: 1a6m–4a
Abordagem: Montessori
Dica / atividade: Atividades de transferir (colher, pinça grande, conta-gotas)
Por que funciona: Preparação da mão para escrever
Materiais: Potes, colheres, grãos grandes (com supervisão)'),
('DES-014', 'desenvolvimento', 'Motor fino', 24, 72, NULL, 'Área: Motor fino
Idade mín. (meses): 24
Idade máx. (meses): 72
Faixa etária: 2a+
Abordagem: Montessori
Dica / atividade: Vida prática: abrir potes, abotoar, descascar banana, servir água de jarrinha
Por que funciona: Autonomia e força das mãos
Materiais: Jarrinha, potes, roupas com botões grandes
O que evitar (segundo a abordagem): Fazer pela criança o que ela já consegue'),
('DES-015', 'desenvolvimento', 'Motor fino', 30, 72, NULL, 'Área: Motor fino
Idade mín. (meses): 30
Idade máx. (meses): 72
Faixa etária: 2a6m+
Abordagem: Reggio Emilia
Dica / atividade: Ateliê com argila, tinta, colagem e materiais diversos
Por que funciona: Muitas linguagens de expressão
Materiais: Argila, tintas, papéis
O que evitar (segundo a abordagem): Modelos prontos para copiar'),
('DES-016', 'desenvolvimento', 'Linguagem', 0, 12, NULL, 'Área: Linguagem
Idade mín. (meses): 0
Idade máx. (meses): 12
Faixa etária: 0m–1a
Abordagem: Neurociência
Dica / atividade: Conversar com o bebê olhando nos olhos e esperar a ''resposta'' (turnos)
Por que funciona: A interação ''serve e devolve'' constrói conexões de linguagem
Materiais: Nenhum
O que evitar (segundo a abordagem): Telas como fonte de linguagem (OMS/SBP: evitar antes dos 2 anos)
Quando conversar com o pediatra: Não reage a sons ou não balbucia aos 9m → pediatra'),
('DES-017', 'desenvolvimento', 'Linguagem', 0, 72, NULL, 'Área: Linguagem
Idade mín. (meses): 0
Idade máx. (meses): 72
Faixa etária: 0m+
Abordagem: RIE (Magda Gerber)
Dica / atividade: Narrar o que vai fazer antes de tocar no bebê (''vou pegar você'')
Por que funciona: Respeito e vocabulário ligado às ações do dia
Materiais: Nenhum
O que evitar (segundo a abordagem): Manusear o bebê sem avisar'),
('DES-018', 'desenvolvimento', 'Linguagem', 6, 36, NULL, 'Área: Linguagem
Idade mín. (meses): 6
Idade máx. (meses): 36
Faixa etária: 6m–3a
Abordagem: Neurociência
Dica / atividade: Ler todos os dias, apontar e nomear figuras
Por que funciona: Vocabulário e atenção conjunta
Materiais: Livros cartonados'),
('DES-019', 'desenvolvimento', 'Linguagem', 12, 36, NULL, 'Área: Linguagem
Idade mín. (meses): 12
Idade máx. (meses): 36
Faixa etária: 1a–3a
Abordagem: Fonoaudiologia
Dica / atividade: Expandir o que a criança fala (''água'' → ''quer água gelada?'')
Por que funciona: Modela frases sem corrigir
Materiais: Nenhum
O que evitar (segundo a abordagem): Corrigir ou pedir para repetir
Quando conversar com o pediatra: Não fala palavras aos 18m ou não junta 2 palavras aos 24m → pediatra'),
('DES-020', 'desenvolvimento', 'Linguagem', 24, 72, NULL, 'Área: Linguagem
Idade mín. (meses): 24
Idade máx. (meses): 72
Faixa etária: 2a+
Abordagem: Waldorf
Dica / atividade: Contar histórias e cantar canções de roda repetidamente
Por que funciona: Repetição e ritmo sustentam memória e linguagem
Materiais: Nenhum'),
('DES-021', 'desenvolvimento', 'Social-emocional', 0, 12, NULL, 'Área: Social-emocional
Idade mín. (meses): 0
Idade máx. (meses): 12
Faixa etária: 0m–1a
Abordagem: Pikler
Dica / atividade: Fazer dos cuidados (troca, banho, refeição) momentos de atenção exclusiva e cooperação
Por que funciona: Constrói vínculo seguro, base para brincar autônomo
Materiais: Nenhum
O que evitar (segundo a abordagem): Trocar fralda com pressa, distraindo com celular'),
('DES-022', 'desenvolvimento', 'Social-emocional', 6, 24, NULL, 'Área: Social-emocional
Idade mín. (meses): 6
Idade máx. (meses): 24
Faixa etária: 6m–2a
Abordagem: RIE
Dica / atividade: Nomear sentimentos (''você ficou bravo porque acabou'') e acolher o choro
Por que funciona: Aprende que emoções são aceitas e têm nome
Materiais: Nenhum
O que evitar (segundo a abordagem): Distrair para fazer parar de chorar
Quando conversar com o pediatra: Não sorri socialmente aos 3m ou não faz contato visual → pediatra'),
('DES-023', 'desenvolvimento', 'Social-emocional', 12, 48, NULL, 'Área: Social-emocional
Idade mín. (meses): 12
Idade máx. (meses): 48
Faixa etária: 1a–4a
Abordagem: RIE
Dica / atividade: Narrar conflitos entre crianças sem resolver por elas (''sportscasting'')
Por que funciona: Desenvolve resolução de problemas e empatia
Materiais: Nenhum
O que evitar (segundo a abordagem): Obrigar a ''emprestar'' imediatamente'),
('DES-024', 'desenvolvimento', 'Social-emocional', 18, 72, NULL, 'Área: Social-emocional
Idade mín. (meses): 18
Idade máx. (meses): 72
Faixa etária: 1a6m+
Abordagem: Disciplina positiva
Dica / atividade: Oferecer escolhas limitadas (''camiseta azul ou verde?'')
Por que funciona: Autonomia com limites
Materiais: Nenhum
O que evitar (segundo a abordagem): Perguntas abertas quando não há escolha'),
('DES-025', 'desenvolvimento', 'Social-emocional', 24, 72, NULL, 'Área: Social-emocional
Idade mín. (meses): 24
Idade máx. (meses): 72
Faixa etária: 2a+
Abordagem: Waldorf
Dica / atividade: Rotina com ritmo previsível (dia com ''respirações'': momentos agitados e calmos)
Por que funciona: Previsibilidade reduz birras
Materiais: Quadro de rotina com figuras'),
('DES-026', 'desenvolvimento', 'Cognitivo', 0, 6, NULL, 'Área: Cognitivo
Idade mín. (meses): 0
Idade máx. (meses): 6
Faixa etária: 0m–6m
Abordagem: Montessori
Dica / atividade: Ambiente simples, com poucos estímulos e objetos reais
Por que funciona: Favorece concentração
O que evitar (segundo a abordagem): Excesso de brinquedos e sons'),
('DES-027', 'desenvolvimento', 'Cognitivo', 6, 36, NULL, 'Área: Cognitivo
Idade mín. (meses): 6
Idade máx. (meses): 36
Faixa etária: 6m–3a
Abordagem: Montessori
Dica / atividade: Poucos brinquedos à vista em prateleira baixa, com rodízio semanal
Por que funciona: Mais foco e escolha autônoma
Materiais: Prateleira baixa
O que evitar (segundo a abordagem): Caixa de brinquedos lotada'),
('DES-028', 'desenvolvimento', 'Cognitivo', 8, 24, NULL, 'Área: Cognitivo
Idade mín. (meses): 8
Idade máx. (meses): 24
Faixa etária: 8m–2a
Abordagem: Piaget / neurociência
Dica / atividade: Jogos de esconder objetos
Por que funciona: Permanência do objeto
Materiais: Pano, copos'),
('DES-029', 'desenvolvimento', 'Cognitivo', 18, 72, NULL, 'Área: Cognitivo
Idade mín. (meses): 18
Idade máx. (meses): 72
Faixa etária: 1a6m+
Abordagem: Reggio Emilia
Dica / atividade: Seguir interesses da criança como projetos (ex.: dinossauros → livros, massinha, passeio)
Por que funciona: Aprender com significado
Materiais: Livros, materiais variados'),
('DES-030', 'desenvolvimento', 'Cognitivo', 24, 72, NULL, 'Área: Cognitivo
Idade mín. (meses): 24
Idade máx. (meses): 72
Faixa etária: 2a+
Abordagem: Brincar livre
Dica / atividade: Tempo diário sem brinquedos dirigidos para inventar brincadeiras
Por que funciona: Criatividade e funções executivas
Materiais: Peças soltas
O que evitar (segundo a abordagem): Agenda cheia de atividades estruturadas'),
('DES-031', 'desenvolvimento', 'Sensorial', 0, 24, NULL, 'Área: Sensorial
Idade mín. (meses): 0
Idade máx. (meses): 24
Faixa etária: 0m–2a
Abordagem: Integração sensorial
Dica / atividade: Oferecer texturas, temperaturas e sons variados em doses pequenas
Por que funciona: Organiza a percepção
Materiais: Tecidos, água, natureza
O que evitar (segundo a abordagem): Forçar o contato quando o bebê recusa'),
('DES-032', 'desenvolvimento', 'Sensorial', 12, 72, NULL, 'Área: Sensorial
Idade mín. (meses): 12
Idade máx. (meses): 72
Faixa etária: 1a+
Abordagem: Brincar livre
Dica / atividade: Bandejas sensoriais e brincadeiras com água e terra
Por que funciona: Regulação e exploração
Materiais: Bacia, areia, água'),
('DES-033', 'desenvolvimento', 'Autonomia', 6, 24, NULL, 'Área: Autonomia
Idade mín. (meses): 6
Idade máx. (meses): 24
Faixa etária: 6m–2a
Abordagem: Pikler
Dica / atividade: Deixar o bebê participar da troca de fralda (levantar pernas, segurar a fralda)
Por que funciona: Cooperação e consciência corporal
Materiais: Nenhum'),
('DES-034', 'desenvolvimento', 'Autonomia', 12, 72, NULL, 'Área: Autonomia
Idade mín. (meses): 12
Idade máx. (meses): 72
Faixa etária: 1a+
Abordagem: Montessori
Dica / atividade: Ambiente acessível: gancho baixo para casaco, banquinho na pia, copo ao alcance
Por que funciona: Independência no dia a dia
Materiais: Móveis baixos, torre de aprendizagem'),
('DES-035', 'desenvolvimento', 'Autonomia', 18, 48, NULL, 'Área: Autonomia
Idade mín. (meses): 18
Idade máx. (meses): 48
Faixa etária: 1a6m–4a
Abordagem: Montessori
Dica / atividade: Desfralde respeitando sinais de prontidão
Por que funciona: Processo mais tranquilo quando a criança está pronta
Materiais: Penico, roupas fáceis
O que evitar (segundo a abordagem): Pressionar ou punir escapes'),
('DES-036', 'desenvolvimento', 'Autonomia', 24, 72, NULL, 'Área: Autonomia
Idade mín. (meses): 24
Idade máx. (meses): 72
Faixa etária: 2a+
Abordagem: Montessori
Dica / atividade: Participar das tarefas de casa (regar, guardar, pôr a mesa)
Por que funciona: Pertencimento e competência
Materiais: Regador, pano'),
('HIG-001', 'higiene', 'Fralda descartável', 0, 36, NULL, 'Categoria: Fralda
Produto (tipo): Fralda descartável
Idade mín. (meses): 0
Idade máx. (meses): 36
Faixa etária: 0m–3a
O que procurar na composição: Boa absorção; tamanho adequado ao peso; cintura elástica que não marca; sem perfume/loção
O que evitar na composição: Fragrância; loções na cobertura para peles sensíveis
Como usar: Trocar a cada 2–3 h ou quando suja; limpar da frente para trás
Observações / quando procurar o pediatra: Marcas de pressão vermelhas → aumentar o tamanho'),
('HIG-002', 'higiene', 'Fralda de pano moderna', 0, 36, NULL, 'Categoria: Fralda
Produto (tipo): Fralda de pano moderna
Idade mín. (meses): 0
Idade máx. (meses): 36
Faixa etária: 0m–3a
O que procurar na composição: Tecido interno respirável (algodão, bambu); cobertura impermeável respirável; absorvente de algodão/bambu
O que evitar na composição: Amaciante (reduz absorção)
Como usar: Trocas um pouco mais frequentes; lavar com sabão neutro
Observações / quando procurar o pediatra: Econômica e sustentável; exige rotina de lavagem'),
('HIG-003', 'higiene', 'Algodão e água morna', 0, 72, NULL, 'Categoria: Limpeza
Produto (tipo): Algodão e água morna
Idade mín. (meses): 0
Idade máx. (meses): 72
Faixa etária: 0m+
O que procurar na composição: Algodão ou pano macio
Como usar: Primeira escolha para recém-nascidos e peles irritadas'),
('HIG-004', 'higiene', 'Lenço umedecido', 1, 72, NULL, 'Categoria: Limpeza
Produto (tipo): Lenço umedecido
Idade mín. (meses): 1
Idade máx. (meses): 72
Faixa etária: 1m+
O que procurar na composição: Sem álcool, sem perfume, poucos ingredientes
O que evitar na composição: Álcool, fragrância, parabenos, metilisotiazolinona (sensibilizante)
Como usar: Para saídas; em casa preferir água'),
('HIG-005', 'higiene', 'Pomada de óxido de zinco', 0, 36, NULL, 'Categoria: Assaduras
Produto (tipo): Pomada de óxido de zinco
Idade mín. (meses): 0
Idade máx. (meses): 36
Faixa etária: 0m–3a
O que procurar na composição: Óxido de zinco (10–40%); base de petrolato ou lanolina
O que evitar na composição: Fragrância; ácido bórico; cânfora
Como usar: Camada generosa a cada troca como barreira; não precisa remover tudo
Observações / quando procurar o pediatra: Assadura com pontinhos vermelhos ao redor ou que não melhora em 3 dias pode ser fungo → pediatra'),
('HIG-006', 'higiene', 'Pomada com dexpantenol / lanolina', 0, 36, NULL, 'Categoria: Assaduras
Produto (tipo): Pomada com dexpantenol / lanolina
Idade mín. (meses): 0
Idade máx. (meses): 36
Faixa etária: 0m–3a
O que procurar na composição: Dexpantenol (vitamina B5) ou lanolina purificada
O que evitar na composição: Fragrância
Como usar: Prevenção diária em peles sem lesão'),
('HIG-007', 'higiene', 'Pomadas com antifúngico ou corticoide', 0, 72, NULL, 'Categoria: Assaduras
Produto (tipo): Pomadas com antifúngico ou corticoide
Idade mín. (meses): 0
Idade máx. (meses): 72
Faixa etária: 0m+
O que procurar na composição: Somente com prescrição
O que evitar na composição: Uso sem orientação
Como usar: Seguir prescrição
Observações / quando procurar o pediatra: Não usar por conta própria'),
('HIG-008', 'higiene', 'Sabonete líquido infantil', 0, 72, NULL, 'Categoria: Banho
Produto (tipo): Sabonete líquido infantil
Idade mín. (meses): 0
Idade máx. (meses): 72
Faixa etária: 0m+
O que procurar na composição: Syndet (sabonete sintético suave) com pH próximo ao da pele (5,5); sem fragrância ou com fragrância hipoalergênica
O que evitar na composição: Sabões alcalinos em barra comuns; lauril sulfato de sódio em peles sensíveis; perfume forte
Como usar: Pouca quantidade, só nas áreas de fralda, dobras e mãos; banho curto (5–10 min)
Observações / quando procurar o pediatra: Recém-nascidos podem tomar banho só com água em parte dos dias'),
('HIG-009', 'higiene', 'Shampoo infantil', 0, 72, NULL, 'Categoria: Banho
Produto (tipo): Shampoo infantil
Idade mín. (meses): 0
Idade máx. (meses): 72
Faixa etária: 0m+
O que procurar na composição: Tensoativos suaves (ex.: cocoamidopropil betaína); fórmula ''sem lágrimas''; sem fragrância
O que evitar na composição: Sulfatos agressivos, parabenos, fragrâncias fortes
Como usar: 2–3 vezes por semana é suficiente em bebês
Observações / quando procurar o pediatra: Crosta láctea: óleo vegetal antes do banho e escova macia'),
('HIG-010', 'higiene', 'Hidratante corporal', 0, 72, NULL, 'Categoria: Hidratação
Produto (tipo): Hidratante corporal
Idade mín. (meses): 0
Idade máx. (meses): 72
Faixa etária: 0m+
O que procurar na composição: Ceramidas, glicerina, manteiga de karité, óleo de girassol; sem perfume
O que evitar na composição: Fragrância, corantes, ureia em alta concentração em bebês pequenos
Como usar: Logo após o banho com a pele ainda úmida, especialmente em peles secas/atópicas
Observações / quando procurar o pediatra: Pele atópica: hidratação diária é parte do cuidado'),
('HIG-011', 'higiene', 'Óleo vegetal para massagem', 1, 72, NULL, 'Categoria: Hidratação
Produto (tipo): Óleo vegetal para massagem
Idade mín. (meses): 1
Idade máx. (meses): 72
Faixa etária: 1m+
O que procurar na composição: Óleo de girassol ou coco puro, sem perfume
O que evitar na composição: Óleo mineral com perfume; óleo de mostarda; óleos essenciais em bebês
Como usar: Na massagem; pequena quantidade
Observações / quando procurar o pediatra: Óleo de oliva pode ressecar peles atópicas'),
('HIG-012', 'higiene', 'Protetor solar', 6, 72, NULL, 'Categoria: Sol
Produto (tipo): Protetor solar
Idade mín. (meses): 6
Idade máx. (meses): 72
Faixa etária: 6m+
O que procurar na composição: Filtros físicos/minerais (óxido de zinco, dióxido de titânio); FPS 30+; próprio para bebês
O que evitar na composição: Oxibenzona; spray próximo ao rosto; fragrância
Como usar: Aplicar 15–30 min antes, reaplicar a cada 2 h e após água
Observações / quando procurar o pediatra: Antes de 6 meses: evitar exposição direta, usar sombra, roupas e chapéu'),
('HIG-013', 'higiene', 'Repelente', 6, 72, NULL, 'Categoria: Insetos
Produto (tipo): Repelente
Idade mín. (meses): 6
Idade máx. (meses): 72
Faixa etária: 6m+
O que procurar na composição: IR3535 a partir de 6 meses; icaridina e DEET somente a partir de 2 anos, em concentração adequada à idade
O que evitar na composição: Aplicar nas mãos, olhos e boca; produtos com repelente + protetor solar juntos
Como usar: Aplicar na pele exposta e nas roupas; reaplicar conforme rótulo
Observações / quando procurar o pediatra: Antes de 6 meses: mosquiteiro e roupas; confirmar produto e idade com pediatra'),
('HIG-014', 'higiene', 'Soro fisiológico 0,9%', 0, 72, NULL, 'Categoria: Nariz
Produto (tipo): Soro fisiológico 0,9%
Idade mín. (meses): 0
Idade máx. (meses): 72
Faixa etária: 0m+
O que procurar na composição: Cloreto de sódio 0,9% sem conservantes (flaconetes)
O que evitar na composição: Descongestionantes nasais sem prescrição (perigosos em crianças)
Como usar: Gotas ou jato suave em cada narina, com a cabeça levemente de lado'),
('HIG-015', 'higiene', 'Aspirador nasal', 0, 36, NULL, 'Categoria: Nariz
Produto (tipo): Aspirador nasal
Idade mín. (meses): 0
Idade máx. (meses): 36
Faixa etária: 0m–3a
O que procurar na composição: Modelo de sucção manual com filtro; bico macio
O que evitar na composição: Sucção muito forte ou frequente (irrita)
Como usar: Após o soro, sem introduzir fundo'),
('HIG-016', 'higiene', 'Creme dental com flúor', 0, 72, NULL, 'Categoria: Dentes
Produto (tipo): Creme dental com flúor
Idade mín. (meses): 0
Idade máx. (meses): 72
Faixa etária: 0m+
O que procurar na composição: Flúor 1.000–1.500 ppm (SBP/ABOPED)
O que evitar na composição: Creme sem flúor como uso rotineiro
Como usar: Desde o primeiro dente: quantidade de grão de arroz até 3 anos; grão de ervilha após
Observações / quando procurar o pediatra: Escovar 2x/dia; o adulto escova até a criança ter coordenação (6–7a)'),
('HIG-017', 'higiene', 'Escova e dedeira', 0, 72, NULL, 'Categoria: Dentes
Produto (tipo): Escova e dedeira
Idade mín. (meses): 0
Idade máx. (meses): 72
Faixa etária: 0m+
O que procurar na composição: Cerdas macias, cabeça pequena
Como usar: Gaze úmida na gengiva antes dos dentes
Observações / quando procurar o pediatra: Trocar a cada 3 meses'),
('HIG-018', 'higiene', 'Tesoura de ponta redonda / lixa', 0, 72, NULL, 'Categoria: Unhas
Produto (tipo): Tesoura de ponta redonda / lixa
Idade mín. (meses): 0
Idade máx. (meses): 72
Faixa etária: 0m+
O que procurar na composição: Ponta arredondada; lixa infantil
Como usar: Cortar com o bebê dormindo ou mamando'),
('HIG-019', 'higiene', 'Álcool 70% (coto umbilical)', 0, 1, NULL, 'Categoria: Umbigo
Produto (tipo): Álcool 70% (coto umbilical)
Idade mín. (meses): 0
Idade máx. (meses): 1
Faixa etária: 0m–1m
O que procurar na composição: Conforme orientação da maternidade (em muitos lugares, apenas manter limpo e seco)
O que evitar na composição: Faixas, moedas, pomadas caseiras
Como usar: Manter seco, limpar a base
Observações / quando procurar o pediatra: Vermelhidão ao redor, cheiro forte ou secreção → pediatra'),
('HIG-020', 'higiene', 'Sabão para roupa do bebê', 0, 72, NULL, 'Categoria: Roupas
Produto (tipo): Sabão para roupa do bebê
Idade mín. (meses): 0
Idade máx. (meses): 72
Faixa etária: 0m+
O que procurar na composição: Sabão neutro ou hipoalergênico, sem corante e sem perfume
O que evitar na composição: Amaciante perfumado
Como usar: Enxaguar bem'),
('HIG-021', 'higiene', 'Termômetro digital', 0, 72, NULL, 'Categoria: Febre
Produto (tipo): Termômetro digital
Idade mín. (meses): 0
Idade máx. (meses): 72
Faixa etária: 0m+
O que procurar na composição: Digital (axilar)
O que evitar na composição: Termômetro de mercúrio
Como usar: Medir na axila por tempo indicado
Observações / quando procurar o pediatra: Bebê com menos de 3 meses com febre (37,8 °C axilar ou mais) → atendimento médico'),
('HIG-022', 'higiene', 'Bolsa térmica morna', 0, 12, NULL, 'Categoria: Cólica/gases
Produto (tipo): Bolsa térmica morna
Idade mín. (meses): 0
Idade máx. (meses): 12
Faixa etária: 0m–1a
O que procurar na composição: Bolsa de gel ou pano aquecido
O que evitar na composição: Temperatura alta
Como usar: Testar no pulso do adulto antes'),
('HIG-023', 'higiene', 'Mosquiteiro', 0, 72, NULL, 'Categoria: Ambiente
Produto (tipo): Mosquiteiro
Idade mín. (meses): 0
Idade máx. (meses): 72
Faixa etária: 0m+
O que procurar na composição: Malha fina, bem fixado
O que evitar na composição: Mosquiteiro solto que pode cair sobre o bebê
Como usar: Sobre berço ou carrinho'),
('HIG-024', 'higiene', 'Banheira / balde de banho', 0, 12, NULL, 'Categoria: Banho
Produto (tipo): Banheira / balde de banho
Idade mín. (meses): 0
Idade máx. (meses): 12
Faixa etária: 0m–1a
O que procurar na composição: Antiderrapante; estável
Como usar: Água na altura segura, temperatura \~36–37 °C (testar com cotovelo)
Observações / quando procurar o pediatra: Nunca deixar o bebê sozinho, nem por segundos'),
('PAS-001', 'passeios', 'Parque com gramado', 0, 72, NULL, 'Passeio: Parque com gramado
Tipo de lugar: Parque
Clima ideal: Sol ameno; nublado
Clima: evitar / adaptar: Calor: sombra e água; frio: camadas
Idade mín. (meses): 0
Idade máx. (meses): 72
Faixa etária: 0m+
Interesses: Natureza; movimento
O que levar: Manta, água, chapéu, protetor (6m+)
Melhor horário: Manhã até 10h ou fim da tarde
Duração: 1–2 h
Custo: Gratuito
Brincadeira no local: Andar descalço, bolhas, piquenique
Cuidados: Sol forte 10h–16h'),
('PAS-002', 'passeios', 'Praça com playground', 9, 72, NULL, 'Passeio: Praça com playground
Tipo de lugar: Praça
Clima ideal: Sol ameno; nublado
Clima: evitar / adaptar: Chuva: não; calor: ir cedo
Idade mín. (meses): 9
Idade máx. (meses): 72
Faixa etária: 9m+
Interesses: Movimento; outras crianças
O que levar: Água, lanche, lenço
Melhor horário: Manhã
Duração: 1 h
Custo: Gratuito
Brincadeira no local: Balanço, escorregador, areia
Cuidados: Conferir brinquedos quentes ao sol e peças quebradas'),
('PAS-003', 'passeios', 'Caminhada no bairro com sling', 0, 12, NULL, 'Passeio: Caminhada no bairro com sling
Tipo de lugar: Rua/bairro
Clima ideal: Qualquer clima ameno
Clima: evitar / adaptar: Frio: bebê dentro do casaco do adulto; calor: evitar
Idade mín. (meses): 0
Idade máx. (meses): 12
Faixa etária: 0m–1a
Interesses: Observação; sono
O que levar: Sling, água
Melhor horário: Manhã ou fim da tarde
Duração: 30–60 min
Custo: Gratuito
Brincadeira no local: Nomear o que vê (cachorro, árvore, carro)
Cuidados: Regras de segurança do sling'),
('PAS-004', 'passeios', 'Feira livre', 6, 72, NULL, 'Passeio: Feira livre
Tipo de lugar: Mercado
Clima ideal: Manhã amena
Clima: evitar / adaptar: Chuva: feira coberta ou mercado municipal
Idade mín. (meses): 6
Idade máx. (meses): 72
Faixa etária: 6m+
Interesses: Comida; cores; pessoas
O que levar: Sacola, carrinho
Melhor horário: Manhã cedo
Duração: 1 h
Custo: Baixo
Brincadeira no local: Escolher uma fruta nova; nomear cores
Cuidados: Movimento de pessoas; segurar a mão'),
('PAS-005', 'passeios', 'Biblioteca pública (espaço infantil)', 6, 72, NULL, 'Passeio: Biblioteca pública (espaço infantil)
Tipo de lugar: Cultural coberto
Clima ideal: Chuva; frio; calor
Idade mín. (meses): 6
Idade máx. (meses): 72
Faixa etária: 6m+
Interesses: Livros; histórias
O que levar: Fralda, lanche (verificar regras)
Melhor horário: Horário de contação de histórias
Duração: 1 h
Custo: Gratuito
Brincadeira no local: Contação de histórias; escolher livros'),
('PAS-006', 'passeios', 'Museu com espaço infantil', 18, 72, NULL, 'Passeio: Museu com espaço infantil
Tipo de lugar: Cultural coberto
Clima ideal: Chuva; calor
Idade mín. (meses): 18
Idade máx. (meses): 72
Faixa etária: 1a6m+
Interesses: Arte; ciência; curiosidade
O que levar: Carrinho leve ou sling
Melhor horário: Manhã (menos cheio)
Duração: 1–2 h
Custo: Gratuito a médio
Brincadeira no local: Caça a cores ou animais nas obras
Cuidados: Verificar se há fraldário'),
('PAS-007', 'passeios', 'Praia', 6, 72, NULL, 'Passeio: Praia
Tipo de lugar: Praia
Clima ideal: Sol ameno; manhã
Clima: evitar / adaptar: Calor intenso: só até 10h ou após 16h
Idade mín. (meses): 6
Idade máx. (meses): 72
Faixa etária: 6m+
Interesses: Água; areia
O que levar: Guarda-sol, protetor mineral, chapéu, água, roupa UV
Melhor horário: Até 10h ou após 16h
Duração: 1–2 h
Custo: Gratuito
Brincadeira no local: Castelo de areia, coletar conchas, pés na água
Cuidados: Criança sempre ao alcance da mão na água; não antes de 6m ao sol direto'),
('PAS-008', 'passeios', 'Cachoeira / rio raso', 24, 72, NULL, 'Passeio: Cachoeira / rio raso
Tipo de lugar: Natureza
Clima ideal: Sol e calor
Clima: evitar / adaptar: Chuva: não ir (cabeça d''água)
Idade mín. (meses): 24
Idade máx. (meses): 72
Faixa etária: 2a+
Interesses: Água; aventura
O que levar: Sapato de água, colete salva-vidas, troca de roupa
Melhor horário: Manhã
Duração: 2–3 h
Custo: Baixo
Brincadeira no local: Explorar pedrinhas e girinos
Cuidados: Risco de correnteza e cabeça d''água; supervisão total'),
('PAS-009', 'passeios', 'Trilha curta e plana', 0, 72, NULL, 'Passeio: Trilha curta e plana
Tipo de lugar: Natureza
Clima ideal: Nublado; ameno
Clima: evitar / adaptar: Chuva: trilha escorregadia; calor: sombra
Idade mín. (meses): 0
Idade máx. (meses): 72
Faixa etária: 0m+
Interesses: Natureza; aventura
O que levar: Carregador ergonômico, água, repelente (conforme idade)
Melhor horário: Manhã
Duração: 1–2 h
Custo: Gratuito
Brincadeira no local: Caça ao tesouro da natureza
Cuidados: Escolher trilhas curtas e acessíveis'),
('PAS-010', 'passeios', 'Jardim botânico', 0, 72, NULL, 'Passeio: Jardim botânico
Tipo de lugar: Natureza
Clima ideal: Qualquer clima ameno
Clima: evitar / adaptar: Chuva fina: estufas
Idade mín. (meses): 0
Idade máx. (meses): 72
Faixa etária: 0m+
Interesses: Plantas; animais
O que levar: Carrinho, água
Melhor horário: Manhã
Duração: 2 h
Custo: Baixo
Brincadeira no local: Cheirar ervas, observar borboletas'),
('PAS-011', 'passeios', 'Zoológico / aquário', 12, 72, NULL, 'Passeio: Zoológico / aquário
Tipo de lugar: Animais
Clima ideal: Nublado (zoo); chuva (aquário)
Clima: evitar / adaptar: Calor: ir cedo
Idade mín. (meses): 12
Idade máx. (meses): 72
Faixa etária: 1a+
Interesses: Animais
O que levar: Carrinho, lanche, água
Melhor horário: Abertura
Duração: 2–3 h
Custo: Médio
Brincadeira no local: Imitar sons dos bichos'),
('PAS-012', 'passeios', 'Fazendinha / hotel-fazenda (visita)', 12, 72, NULL, 'Passeio: Fazendinha / hotel-fazenda (visita)
Tipo de lugar: Animais/rural
Clima ideal: Sol ameno
Clima: evitar / adaptar: Chuva: barro
Idade mín. (meses): 12
Idade máx. (meses): 72
Faixa etária: 1a+
Interesses: Animais; natureza
O que levar: Botas, roupa que suja
Melhor horário: Manhã
Duração: Meio dia
Custo: Médio
Brincadeira no local: Dar comida aos animais, andar de pônei (3a+)
Cuidados: Lavar as mãos após tocar animais'),
('PAS-013', 'passeios', 'Horta comunitária', 18, 72, NULL, 'Passeio: Horta comunitária
Tipo de lugar: Natureza
Clima ideal: Ameno
Idade mín. (meses): 18
Idade máx. (meses): 72
Faixa etária: 1a6m+
Interesses: Plantas; cozinhar
O que levar: Balde, pá
Melhor horário: Manhã
Duração: 1 h
Custo: Gratuito
Brincadeira no local: Regar, colher, sentir o cheiro das ervas'),
('PAS-014', 'passeios', 'Piquenique', 6, 72, NULL, 'Passeio: Piquenique
Tipo de lugar: Parque
Clima ideal: Sol ameno; nublado
Clima: evitar / adaptar: Calor: sombra; frio: cobertor
Idade mín. (meses): 6
Idade máx. (meses): 72
Faixa etária: 6m+
Interesses: Comida; natureza
O que levar: Toalha, lanche da família, água
Melhor horário: Manhã ou fim de tarde
Duração: 1–2 h
Custo: Baixo
Brincadeira no local: Leitura na toalha, bolhas, bola
Cuidados: Alimentos seguros para a idade'),
('PAS-015', 'passeios', 'Brincar na chuva (com roupa adequada)', 18, 72, NULL, 'Passeio: Brincar na chuva (com roupa adequada)
Tipo de lugar: Quintal/rua calma
Clima ideal: Chuva fraca e morna, sem raios
Clima: evitar / adaptar: Frio: não; tempestade: não
Idade mín. (meses): 18
Idade máx. (meses): 72
Faixa etária: 1a6m+
Interesses: Água; sensorial
O que levar: Galocha, capa, toalha e roupa seca
Melhor horário: Qualquer
Duração: 20–40 min
Custo: Gratuito
Brincadeira no local: Pular em poças, barquinho de papel
Cuidados: Nunca com raios; secar e trocar logo'),
('PAS-016', 'passeios', 'Shopping / espaço kids coberto', 6, 72, NULL, 'Passeio: Shopping / espaço kids coberto
Tipo de lugar: Coberto
Clima ideal: Chuva forte; calor extremo; frio
Idade mín. (meses): 6
Idade máx. (meses): 72
Faixa etária: 6m+
Interesses: Movimento; outras crianças
O que levar: Meias antiderrapantes, água
Melhor horário: Manhã em dia útil
Duração: 1–2 h
Custo: Baixo a médio
Brincadeira no local: Espaço de brincar, caminhar
Cuidados: Estímulo excessivo; atenção à hora do cochilo'),
('PAS-017', 'passeios', 'Aula de musicalização para bebês', 4, 48, NULL, 'Passeio: Aula de musicalização para bebês
Tipo de lugar: Atividade
Clima ideal: Qualquer
Idade mín. (meses): 4
Idade máx. (meses): 48
Faixa etária: 4m–4a
Interesses: Música; interação
O que levar: Garrafa de água
Melhor horário: Manhã
Duração: 45 min
Custo: Médio
Cuidados: Escolher turmas pequenas'),
('PAS-018', 'passeios', 'Natação para bebês', 6, 72, NULL, 'Passeio: Natação para bebês
Tipo de lugar: Atividade
Clima ideal: Qualquer (piscina aquecida)
Clima: evitar / adaptar: Frio: secar bem
Idade mín. (meses): 6
Idade máx. (meses): 72
Faixa etária: 6m+
Interesses: Água
O que levar: Fralda de piscina, roupão
Melhor horário: Manhã
Duração: 30–45 min
Custo: Médio
Cuidados: Não substitui supervisão nem ensina a criança a se salvar'),
('PAS-019', 'passeios', 'Passeio de bicicleta com cadeirinha', 12, 72, NULL, 'Passeio: Passeio de bicicleta com cadeirinha
Tipo de lugar: Rua/parque
Clima ideal: Ameno
Clima: evitar / adaptar: Chuva: não
Idade mín. (meses): 12
Idade máx. (meses): 72
Faixa etária: 1a+
Interesses: Movimento; vento
O que levar: Capacete infantil, cadeirinha certificada
Melhor horário: Manhã
Duração: 30–60 min
Custo: Baixo
Brincadeira no local: Nomear o que vê
Cuidados: Capacete sempre; ciclovias'),
('PAS-020', 'passeios', 'Visita aos avós/família', 0, 72, NULL, 'Passeio: Visita aos avós/família
Tipo de lugar: Casa
Clima ideal: Qualquer
Idade mín. (meses): 0
Idade máx. (meses): 72
Faixa etária: 0m+
Interesses: Vínculo
O que levar: Bolsa do bebê
Melhor horário: Adaptar ao cochilo
Duração: Variável
Custo: Gratuito
Brincadeira no local: Mostrar fotos antigas da família
Cuidados: Casa segura para a idade (tomadas, escadas, remédios)'),
('PAS-021', 'passeios', 'Parquinho aquático / fonte interativa', 12, 72, NULL, 'Passeio: Parquinho aquático / fonte interativa
Tipo de lugar: Parque
Clima ideal: Calor
Clima: evitar / adaptar: Frio: não
Idade mín. (meses): 12
Idade máx. (meses): 72
Faixa etária: 1a+
Interesses: Água
O que levar: Roupa de banho, protetor, toalha
Melhor horário: Até 10h ou após 16h
Duração: 1 h
Custo: Gratuito a baixo
Brincadeira no local: Correr nos jatos
Cuidados: Piso escorregadio'),
('PAS-022', 'passeios', 'Observar pássaros / aviões / trens', 12, 72, NULL, 'Passeio: Observar pássaros / aviões / trens
Tipo de lugar: Rua/parque
Clima ideal: Sol ameno
Idade mín. (meses): 12
Idade máx. (meses): 72
Faixa etária: 1a+
Interesses: Veículos; animais
O que levar: Binóculo de brinquedo
Melhor horário: Qualquer
Duração: 30–60 min
Custo: Gratuito
Brincadeira no local: Contar e nomear'),
('PAS-023', 'passeios', 'Teatro infantil', 24, 72, NULL, 'Passeio: Teatro infantil
Tipo de lugar: Cultural coberto
Clima ideal: Chuva; qualquer
Idade mín. (meses): 24
Idade máx. (meses): 72
Faixa etária: 2a+
Interesses: Histórias; música
O que levar: Lanche
Melhor horário: Fins de semana, manhã
Duração: 1 h
Custo: Médio
Brincadeira no local: Recontar a história em casa
Cuidados: Sessões curtas; sentar perto da saída'),
('PAS-024', 'passeios', 'Cinema para bebês (sessões adaptadas)', 0, 12, NULL, 'Passeio: Cinema para bebês (sessões adaptadas)
Tipo de lugar: Cultural coberto
Clima ideal: Chuva
Idade mín. (meses): 0
Idade máx. (meses): 12
Faixa etária: 0m–1a
Interesses: Pais; socialização
O que levar: Sling
Melhor horário: Manhã
Duração: 1,5 h
Custo: Médio
Cuidados: Som baixo; é passeio para os pais com o bebê junto'),
('PAS-025', 'passeios', 'Grupo de mães/pais e bebês', 0, 24, NULL, 'Passeio: Grupo de mães/pais e bebês
Tipo de lugar: Comunidade
Clima ideal: Qualquer
Idade mín. (meses): 0
Idade máx. (meses): 24
Faixa etária: 0m–2a
Interesses: Social
Melhor horário: Manhã
Duração: 1–2 h
Custo: Gratuito a baixo'),
('PAS-026', 'passeios', 'Caminhada ao pôr do sol', 0, 72, NULL, 'Passeio: Caminhada ao pôr do sol
Tipo de lugar: Rua/parque
Clima ideal: Sol; calor
Clima: evitar / adaptar: Frio: agasalho
Idade mín. (meses): 0
Idade máx. (meses): 72
Faixa etária: 0m+
Interesses: Calma; natureza
O que levar: Água, casaco leve
Melhor horário: Fim da tarde
Duração: 30–45 min
Custo: Gratuito
Brincadeira no local: Observar cores do céu
Cuidados: Luz de fim de tarde ajuda o ritmo de sono'),
('PAS-027', 'passeios', 'Passeio de barco/balsa curto', 12, 72, NULL, 'Passeio: Passeio de barco/balsa curto
Tipo de lugar: Aventura
Clima ideal: Sol ameno
Clima: evitar / adaptar: Chuva/vento: não
Idade mín. (meses): 12
Idade máx. (meses): 72
Faixa etária: 1a+
Interesses: Água; veículos
O que levar: Colete salva-vidas infantil
Melhor horário: Manhã
Duração: 30–60 min
Custo: Baixo
Brincadeira no local: Contar peixes e barcos
Cuidados: Colete sempre'),
('PAS-028', 'passeios', 'Colher frutas (pomar/pick-your-own)', 18, 72, NULL, 'Passeio: Colher frutas (pomar/pick-your-own)
Tipo de lugar: Rural
Clima ideal: Sol ameno
Clima: evitar / adaptar: Chuva: barro
Idade mín. (meses): 18
Idade máx. (meses): 72
Faixa etária: 1a6m+
Interesses: Comida; natureza
O que levar: Balde, chapéu
Melhor horário: Manhã
Duração: 2 h
Custo: Médio
Brincadeira no local: Contar e separar frutas
Cuidados: Frutas pequenas: risco de engasgo');
