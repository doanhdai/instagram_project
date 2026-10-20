# Kubernetes (kind) cho môi trường local
KIND_CLUSTER ?= instagram
K8S_NAMESPACE ?= instagram
BACKEND_IMAGE ?= instagram-backend:local
FRONTEND_IMAGE ?= instagram-frontend:local
PUBLIC_HOST ?= instagram.local
PUBLIC_URL ?= http://$(PUBLIC_HOST)

.PHONY: help k8s-cluster k8s-ingress k8s-build k8s-load k8s-secrets k8s-apply k8s-up k8s-redeploy k8s-down k8s-status k8s-logs compose-up compose-down

help:
	@echo "Các target:"
	@echo "  make k8s-up       Tạo kind cluster, build image, deploy toàn bộ stack"
	@echo "  make k8s-redeploy Build lại image và rollout bản mới"
	@echo "  make k8s-down     Xoá kind cluster"
	@echo "  make k8s-status   Xem trạng thái pod/service trong namespace $(K8S_NAMESPACE)"
	@echo "  make k8s-logs     Theo dõi log backend"
	@echo "  make compose-up   Chạy stack bằng Docker Compose (có Redis)"
	@echo "  make compose-down Dừng stack Docker Compose"

k8s-cluster:
	kind get clusters | grep -qx "$(KIND_CLUSTER)" || kind create cluster --config k8s/kind-config.yaml

k8s-ingress:
	kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
	kubectl -n ingress-nginx wait --for=condition=available deployment/ingress-nginx-controller --timeout=180s
	@echo "Chờ admission webhook của ingress-nginx sẵn sàng..."
	@for i in $$(seq 1 60); do \
		if kubectl -n ingress-nginx get endpoints ingress-nginx-controller-admission -o jsonpath='{.subsets[*].addresses[*].ip}' 2>/dev/null | grep -q .; then \
			echo "Webhook sẵn sàng."; break; \
		fi; \
		sleep 2; \
	done

k8s-build:
	docker build -t $(BACKEND_IMAGE) ./backend_instagram
	docker build -t $(FRONTEND_IMAGE) --build-arg REACT_APP_API_URL=$(PUBLIC_URL) ./Social-app-fontend

k8s-load: k8s-cluster
	kind load docker-image $(BACKEND_IMAGE) --name $(KIND_CLUSTER)
	kind load docker-image $(FRONTEND_IMAGE) --name $(KIND_CLUSTER)

k8s-secrets: k8s-cluster
	./k8s/create-secrets.sh

k8s-apply:
	kubectl kustomize --load-restrictor LoadRestrictionsNone k8s | kubectl apply -f -
	kubectl -n $(K8S_NAMESPACE) rollout status deployment/backend --timeout=300s
	kubectl -n $(K8S_NAMESPACE) rollout status deployment/frontend --timeout=180s

k8s-up: k8s-cluster k8s-ingress k8s-build k8s-load k8s-secrets k8s-apply
	@echo ""
	@echo "Ứng dụng đã chạy tại $(PUBLIC_URL)"
	@echo "Thêm dòng sau vào /etc/hosts nếu chưa có: 127.0.0.1 $(PUBLIC_HOST)"
	@kubectl -n $(K8S_NAMESPACE) get pods

k8s-redeploy: k8s-build k8s-load k8s-secrets
	kubectl -n $(K8S_NAMESPACE) rollout restart deployment/backend deployment/frontend
	kubectl -n $(K8S_NAMESPACE) rollout status deployment/backend --timeout=300s
	kubectl -n $(K8S_NAMESPACE) rollout status deployment/frontend --timeout=180s

k8s-status:
	kubectl -n $(K8S_NAMESPACE) get pods,svc,ingress

k8s-logs:
	kubectl -n $(K8S_NAMESPACE) logs -f deployment/backend

k8s-down:
	kind delete cluster --name $(KIND_CLUSTER)

compose-up:
	docker compose up --build -d

compose-down:
	docker compose down
