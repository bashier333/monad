-- Board favorites: one boolean, toggled by owners, listed first.
ALTER TABLE "Board" ADD COLUMN "isFavorite" BOOLEAN NOT NULL DEFAULT false;
