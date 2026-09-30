"""Who can see what: files tagged with companies or a country are visible to people assigned to them."""
from dataclasses import dataclass, field

from .models import FileMeta, UserAccess

USER_HEADER = "X-User-Email"


@dataclass
class Viewer:
    email: str
    name: str = ""
    see_all: bool = False
    company_ids: set = field(default_factory=set)
    countries: set = field(default_factory=set)


def viewer_for(request):
    """The viewer named by the X-User-Email header (or ?as=). None = no user given, everything visible."""
    email = (request.headers.get(USER_HEADER) or request.GET.get("as") or "").strip().lower()
    if not email:
        return None
    access = UserAccess.objects.filter(email__iexact=email).prefetch_related("companies").first()
    if access is None:
        return Viewer(email=email)  # unknown people only see untagged files
    return Viewer(
        email=email,
        name=access.name,
        see_all=access.see_all,
        company_ids={c.id for c in access.companies.all()},
        countries={c.upper() for c in access.countries},
    )


def file_company_ids(f):
    try:
        ids = {c.id for c in f.meta.companies.all()}
    except FileMeta.DoesNotExist:
        ids = set()
    if f.customer_id:
        ids.add(f.customer_id)
    return ids


def can_see(f, viewer):
    if viewer is None or viewer.see_all:
        return True
    companies = file_company_ids(f)
    if not companies and not f.country:
        return True
    return bool(companies & viewer.company_ids) or f.country in viewer.countries


def author_name(request, body=None):
    """Who is making a change: body["changedBy"/"author"], else the viewer, else "anonymous"."""
    body = body or {}
    for key in ("changedBy", "author"):
        if isinstance(body.get(key), str) and body[key].strip():
            return body[key].strip()[:200]
    viewer = viewer_for(request)
    if viewer:
        return viewer.name or viewer.email
    return "anonymous"
