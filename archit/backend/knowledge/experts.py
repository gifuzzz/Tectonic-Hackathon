"""Expert lookup from document ownership, past cases, customer history and expertise tags."""
from .models import Case, DriveFile, Expert


def find_experts(customer=None, country="", topic="", files=(), limit=10):
    """Return [{"expert", "score", "reasons"}], best first. Without filters every expert scores 0."""
    results = []
    for expert in Expert.objects.filter(active=True).prefetch_related("customers"):
        score, reasons = 0, []
        tags = {t.lower() for t in expert.expertise_tags}
        owned = DriveFile.objects.filter(owner=expert, trashed=False, is_folder=False)
        cases = Case.objects.filter(assigned_expert=expert)

        for f in files:
            if f.owner_id == expert.id:
                score += 5
                reasons.append(f"owns '{f.name}'")
        if topic:
            n = owned.filter(topic=topic).count()
            if n:
                score += 3 * min(n, 3)
                reasons.append(f"owns {n} {topic} document(s)")
            n = cases.filter(topic=topic).count()
            if n:
                score += 2 * min(n, 3)
                reasons.append(f"handled {n} past {topic} case(s)")
            if topic.lower() in tags:
                score += 2
                reasons.append(f"expertise tag '{topic}'")
        if customer:
            n = owned.filter(customer=customer).count()
            if n:
                score += 3 * min(n, 3)
                reasons.append(f"owns {n} {customer.name} document(s)")
            n = cases.filter(customer=customer).count()
            if n:
                score += 2 * min(n, 3)
                reasons.append(f"handled {n} past {customer.name} case(s)")
            if any(c.id == customer.id for c in expert.customers.all()):
                score += 3
                reasons.append(f"customer history with {customer.name}")
            if customer.name.lower() in tags:
                score += 2
                reasons.append(f"expertise tag '{customer.name}'")
        if country:
            n = owned.filter(country=country).count()
            if n:
                score += min(n, 3)
                reasons.append(f"owns {n} {country} document(s)")
            if country.lower() in tags:
                score += 2
                reasons.append(f"expertise tag '{country}'")
        results.append({"expert": expert, "score": score, "reasons": reasons})

    results.sort(key=lambda r: (-r["score"], r["expert"].name))
    return results[:limit]
