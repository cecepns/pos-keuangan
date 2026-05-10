import api from "./client";
import { PAGE_SIZE } from "../constants/pagination";

/** Ambil seluruh baris dengan mem-paginate GET `{ data, total, page, limit }` */
export async function fetchAllPages(url, extraParams = {}) {
  const all = [];
  let page = 1;
  for (;;) {
    const { data } = await api.get(url, { params: { ...extraParams, page, limit: PAGE_SIZE } });
    const rows = Array.isArray(data?.data) ? data.data : [];
    const total = Number(data?.total ?? rows.length);
    all.push(...rows);
    if (rows.length === 0 || all.length >= total || rows.length < PAGE_SIZE) break;
    page += 1;
    if (page > 1000) break;
  }
  return all;
}
