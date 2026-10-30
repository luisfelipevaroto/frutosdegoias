-- Consultas somente leitura. Nao retornam dados pessoais ou credenciais.
SELECT
 (SELECT count(*) FROM public.grupos_adicionais) AS grupos,
 (SELECT count(*) FROM public.adicionais WHERE grupo_id IS NOT NULL) AS itens_em_grupos,
 (SELECT count(*) FROM public.produto_grupos_adicionais) AS vinculacoes,
 (SELECT count(DISTINCT produto_id) FROM public.produto_grupos_adicionais) AS produtos_com_grupos;

-- Deve retornar zero: grupos vinculados a produtos de outra empresa.
SELECT count(*) AS vinculos_entre_empresas
FROM public.produto_grupos_adicionais pg
JOIN public.produtos p ON p.id = pg.produto_id
JOIN public.grupos_adicionais g ON g.id = pg.grupo_id
WHERE p.empresa_id IS DISTINCT FROM g.empresa_id;

-- Deve retornar zero: adicionais associados a grupos de outra empresa.
SELECT count(*) AS itens_entre_empresas
FROM public.adicionais a
JOIN public.grupos_adicionais g ON g.id = a.grupo_id
WHERE a.empresa_id IS DISTINCT FROM g.empresa_id;

-- Deve retornar zero: vinculos avulsos entre empresas.
SELECT count(*) AS adicionais_avulsos_entre_empresas
FROM public.produto_adicionais pa
JOIN public.produtos p ON p.id = pa.produto_id
JOIN public.adicionais a ON a.id = pa.adicional_id
WHERE p.empresa_id IS DISTINCT FROM a.empresa_id;

-- Deve retornar zero: grupos ativos com menos itens ativos do que o minimo exigido.
SELECT count(*) AS grupos_sem_minimo
FROM public.grupos_adicionais g
WHERE g.ativo AND (
 SELECT count(*) FROM public.adicionais a
 WHERE a.grupo_id = g.id AND a.empresa_id = g.empresa_id AND a.ativo
) < g.minimo;
