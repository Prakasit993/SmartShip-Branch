-- Function to safely decrement stock
create or replace function decrement_stock(row_id bigint, amount int)
returns void as $$
begin
  update public.products
  set stock_quantity = stock_quantity - amount
  where id = row_id;
end;
$$ language plpgsql;
