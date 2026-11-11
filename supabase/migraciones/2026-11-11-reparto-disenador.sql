-- Parte del diseñador: porcentaje del beneficio (precio cobrado − coste de Gelato) de cada producto
alter table public.productos add column if not exists reparto_disenador numeric not null default 0 check (reparto_disenador between 0 and 100);
comment on column public.productos.reparto_disenador is 'Porcentaje del beneficio (precio cobrado - coste Gelato) que se paga al diseñador';
update public.productos set reparto_disenador = 50 where seccion in ('camisetas','camisetas-oversize','sudaderas');
