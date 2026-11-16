-- País de onde veio o envio (código de 2 letras que a Cloudflare tira do IP). O IP não é guardado.
ALTER TABLE reports ADD COLUMN country TEXT;
