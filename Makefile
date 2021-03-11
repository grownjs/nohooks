help: Makefile
	@awk -F':.*?##' '/^[a-z0-9\\%!:-]+:.*##/{gsub("%","*",$$1);gsub("\\\\",":*",$$1);printf "\033[36m%8s\033[0m %s\n",$$1,$$2}' $<

ci: deps ## Run CI scripts
	@npm run test:ci

dev: deps ## Start dev tasks
	@npm run dev

test: deps ## Run coverage checks locally
	@npm run coverage
	@npm run report -- -r html

deps: package*.json
	@(((ls node_modules | grep .) > /dev/null 2>&1) || npm i) || true
