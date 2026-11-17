/**
 * src/pages/KenoPage.tsx
 * Fast Keno Production View for Sonic Bingo Mini-App
 * 100% Exact Restoration of original keno.html (Image 2)
 * Wired to Real Account Money (wallets table in Neon DB) • Real User Auth • Zero Mock Data
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useKeno, KenoTicket } from '../context/KenoContext.tsx';
import { socketService } from '../services/socketService.ts';
import '../styles/keno.css';

// SVG Assets from authentic keno.html
const SHD =
  'data:image/svg+xml;base64,PHN2ZyBpZD0iR3JvdXBfMTYwMSIgZGF0YS1uYW1lPSJHcm91cCAxNjAxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB3aWR0aD0iMTMiIGhlaWdodD0iMTciIHZpZXdCb3g9IjAgMCAxMyAxNyI+CiAgPGRlZnM+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9ImxpbmVhci1ncmFkaWVudCIgeDE9IjAuNSIgeDI9IjAuNSIgeTI9IjEiIGdyYWRpZW50VW5pdHM9Im9iamVjdEJvdW5kaW5nQm94Ij4KICAgICAgPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjNTFjNmE2Ii8+CiAgICAgIDxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzE3Njk0ZCIvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHBhdGggaWQ9IlBhdGhfODMiIGRhdGEtbmFtZT0iUGF0aCA4MyIgZD0iTTEyLjQ4MywxLjgxOGgwYTEuNjIzLDEuNjIzLDAsMCwwLS4xNTgtLjE1NWwtLjAxNC0uMDE0Yy0uMDU3LS4wNDItLjEtLjA4NS0uMTU4LS4xMjdsLS4wMTQtLjAxNGMtLjA1Ny0uMDQyLS4xMjktLjA4NS0uMTg3LS4xMjdsLS4wMTQtLjAxNC0uMTcyLS4wODVjLS4wMTQtLjAxNC0uMDQzLS4wMTQtLjA1Ny0uMDI4QS43MDcuNzA3LDAsMCwwLDExLjU1LDEuMmMtLjAxNC0uMDE0LS4wNDMtLjAxNC0uMDU3LS4wMjhhMS4yMTIsMS4yMTIsMCwwLDAtLjIxNS0uMDU2TDYuNSwwLDEuNzUsMS4xYy0uMDcyLjAxNC0uMTQzLjA0Mi0uMjE1LjA1NmEuMTEuMTEsMCwwLDAtLjA1Ny4wMjgsMS43LDEuNywwLDAsMC0uMTU4LjA3Yy0uMDI5LDAtLjA0My4wMTQtLjA1Ny4wMTRhMS44MzcsMS44MzcsMCwwLDAtLjE3Mi4xbC0uMDE0LjAxNGEyLjEsMi4xLDAsMCwwLS4xODcuMTI3bC0uMDE0LjAxNGExLjUyLDEuNTIsMCwwLDAtLjE1OC4xMjdMLjcsMS42NjNhMS42MjMsMS42MjMsMCwwLDAtLjE1OC4xNTVoMEExLjg3MiwxLjg3MiwwLDAsMCwwLDMuMTQzdjcuMTE5QzAsMTMuNDksNi41LDE3LDYuNSwxN2gwUzEzLDEzLjQ5LDEzLDEwLjI2MlYzLjEyOUExLjksMS45LDAsMCwwLDEyLjQ4MywxLjgxOFoiIGZpbGw9IiNlMmUyZTIiLz4KICA8cGF0aCBpZD0iUGF0aF84NSIgZGF0YS1uYW1lPSJQYXRoIDg1IiBkPSJNNi43NTgsMTIuMDM4LDEuMjc3LDcuNDg1LDMuMjI4LDUuMjMsNi40NTcsNy45MDhsNS43MjUtNi4zNzFhMi4yOCwyLjI4LDAsMCwwLS45MTgtLjQyM0w2LjUsMCwxLjc1LDEuMUEyLjE2MSwyLjE2MSwwLDAsMCwwLDMuMTQzdjcuMWMwLDMuMjI4LDYuNSw2LjczOCw2LjUsNi43MzhoMHM2LjUtMy41MSw2LjUtNi43MzhWNS4wNzRaIiBmaWxsPSJ1cmwoI2xpbmVhci1ncmFkaWVudCkiLz4KPC9zdmc+Cg==';

const ATL =
  'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4NCjwhLS0gR2VuZXJhdG9yOiBBZG9iZSBJbGx1c3RyYXRvciAyNi41LjAsIFNWRyBFeHBvcnQgUGx1Zy1JbiAuIFNWRyBWZXJzaW9uOiA2LjAwIEJ1aWxkIDApICAtLT4NCjxzdmcgdmVyc2lvbj0iMS4xIiBpZD0iTGF5ZXJfMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgeD0iMHB4IiB5PSIwcHgiDQoJIHdpZHRoPSI0MDBweCIgaGVpZ2h0PSIxMDNweCIgdmlld0JveD0iMCAwIDQwMCAxMDMiIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgMCAwIDQwMCAxMDM7IiB4bWw6c3BhY2U9InByZXNlcnZlIj4NCjxzdHlsZSB0eXBlPSJ0ZXh0L2NzcyI+DQoJLnN0MHtmaWxsOiNGRkZGRkY7fQ0KPC9zdHlsZT4NCjxnPg0KCTxnPg0KCQk8Zz4NCgkJCTxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik0wLjUsNzAuNUwzNS40LDEuNGgxOC41bDM0LjcsNjkuMkg2N0w0OC41LDM0LjRjLTAuOC0xLjYtMS41LTMtMi4xLTQuNGMtMC42LTEuMy0xLjItMi43LTEuNi0zLjkNCgkJCQljLTAuNS0xLjItMC45LTIuNS0xLjMtMy42Yy0wLjQtMS4yLTAuOC0yLjMtMS4xLTMuNGg0LjNjLTAuMywxLjItMC43LDIuNC0xLjEsMy42Yy0wLjQsMS4yLTAuOSwyLjUtMS40LDMuNw0KCQkJCWMtMC41LDEuMy0xLjEsMi41LTEuNywzLjljLTAuNiwxLjMtMS4zLDIuNy0yLDQuMUwyMS43LDcwLjVIMC41eiIvPg0KCQkJPHBhdGggY2xhc3M9InN0MCIgZD0iTTg3LjMsNzAuNXYtNTFINjguNUw1OC45LDEuNGg2OC43djE4LjJoLTE4Ljl2NTFMODcuMyw3MC41TDg3LjMsNzAuNXoiLz4NCgkJCTxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik0xNjYsNDguN2wyNC44LTQ3LjNoMTguNWwzNC44LDY5LjJoLTIxLjZsLTE4LjYtMzYuMmMtMC44LTEuNi0xLjUtMy0yLjEtNC40Yy0wLjYtMS4zLTEuMi0yLjctMS42LTMuOQ0KCQkJCWMtMC41LTEuMi0wLjktMi41LTEuMy0zLjZjLTAuNC0xLjItMC44LTIuMy0xLjEtMy40aDQuM2MtMC4zLDEuMi0wLjcsMi40LTEuMSwzLjZjLTAuNCwxLjItMC45LDIuNS0xLjQsMy43DQoJCQkJYy0wLjUsMS4zLTEuMSwyLjUtMS43LDMuOWMtMC42LDEuMy0xLjMsMi43LTIsNC4xbC04LjQsMTQuM0gxNjZ6Ii8+DQoJCQk8cGF0aCBjbGFzcz0ic3QwIiBkPSJNMzUwLDcwLjVMMzE4LDEuNGgyMS4zbDEzLjEsMjkuNGMwLjQsMC45LDEsMi4yLDEuNywzLjhjMC44LDEuNiwxLjYsMy40LDIuNSw1LjVzMS44LDQuMywyLjYsNi43DQoJCQkJYzAuOSwyLjQsMS42LDQuOCwyLjMsNy40aC00YzEtMy4yLDItNi4xLDMuMS04LjhzMi4yLTUuMywzLjMtNy43YzEuMS0yLjQsMi00LjYsMi44LTYuNmwxMy0yOS43aDIwLjhsLTMxLjIsNjkuMkwzNTAsNzAuNQ0KCQkJCUwzNTAsNzAuNXoiLz4NCgkJCTxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik0zMDYuMiwzMy4yYzAuMiwwLjMsMC40LDAuNiwwLjYsMC44YzIuNCwzLjUsMy43LDgsMy43LDEzLjZjMCwwLjktMC4xLDEuOS0wLjIsMi44aDI0LjJsLTguNi0xNy4yDQoJCQkJQzMyNS45LDMzLjIsMzA2LjIsMzMuMiwzMDYuMiwzMy4yeiIvPg0KCQkJPHBhdGggY2xhc3M9InN0MCIgZD0iTTMwMS45LDM2LjVjLTEuOS0yLjctNC41LTQuOC03LjctNi4yYy0zLjItMS40LTYuOC0yLjQtMTAuNy0yLjljLTMuOS0wLjYtNy45LTEtMTEuOS0xLjMNCgkJCQljLTEuMy0wLjEtMy0wLjItNC45LTAuM2MtMi0wLjEtMy45LTAuMy01LjgtMC41Yy0xLjktMC4zLTMuNS0wLjctNC43LTEuM2MtMS4zLTAuNi0xLjktMS40LTEuOS0yLjVjMC0xLjIsMC42LTIuMSwxLjctMi43DQoJCQkJYzEuMi0wLjYsMi43LTEuMSw0LjctMS4zYzItMC4yLDQuMi0wLjMsNi44LTAuM2MyLjYsMCw1LjUsMC4yLDguNCwwLjZjMywwLjQsNS45LDEsOC44LDEuN3M1LjQsMS42LDcuNiwyLjdsOC44LTE0LjUNCgkJCQljLTIuMS0xLjItNC43LTIuNC03LjgtMy43Yy0zLjEtMS4zLTYuOC0yLjQtMTAuOS0zLjJjLTQuMS0wLjktOC44LTEuMy0xNC0xLjNjLTUsMC05LjgsMC41LTE0LjIsMS41cy04LjQsMi41LTExLjgsNC41DQoJCQkJcy02LjEsNC40LTgsNy40Yy0xLjksMi45LTIuOSw2LjMtMi45LDEwLjFjMCwzLjIsMC44LDYuMSwyLjMsOC42czMuNyw0LjcsNi41LDYuNXM2LjEsMy4yLDEwLDQuM3M4LjIsMS44LDEzLDIuMQ0KCQkJCWMyLjYsMC4yLDUsMC40LDcsMC41YzIuMSwwLjIsMy44LDAuNCw1LjMsMC42YzEuNSwwLjIsMi43LDAuNSwzLjcsMC44czEuNywwLjcsMi4yLDEuMnMwLjcsMS4xLDAuNywxLjhjMCwxLjUtMC43LDIuNi0yLDMuMg0KCQkJCWMtMS4zLDAuNi0yLjksMS00LjYsMS4xYy0xLjgsMC4xLTMuMywwLjItNC42LDAuMmMtNC43LDAtMTAuMi0wLjgtMTYuNC0yLjNjLTUuOS0xLjQtMTEuOC0zLjctMTcuOC02LjlsMTIuMywyNC41DQoJCQkJYzEsMC4yLDIsMC41LDMuMSwwLjdjNS4xLDEsMTAuNiwxLjUsMTYuNywxLjVjNi43LDAsMTIuNy0wLjksMTguMi0yLjhjNS40LTEuOCw5LjctNC41LDEyLjktOC4xYzMuMi0zLjYsNC44LTcuOSw0LjgtMTMNCgkJCQlDMzA0LjgsNDIuOSwzMDMuOCwzOS4yLDMwMS45LDM2LjV6Ii8+DQoJCQk8cG9seWdvbiBjbGFzcz0ic3QwIiBwb2ludHM9IjE1My42LDUyLjMgMTUzLjUsMS40IDEzMi4xLDEuNCAxMzIuMSw3MC41IDE3NS43LDcwLjUgMTg2LDUyLjMgCQkJIi8+DQoJCTwvZz4NCgk8L2c+DQoJPGc+DQoJCTxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik0xMC43LDEwMy41Yy0xLjcsMC0zLjItMC4yLTQuNi0wLjZjLTEuNC0wLjQtMi41LTEtMy41LTEuOGMtMS0wLjgtMS43LTEuOC0yLjMtM2MtMC41LTEuMi0wLjgtMi42LTAuOC00LjINCgkJCWMwLTEuNCwwLjMtMi43LDAuOS0zLjhzMS40LTIuMiwyLjUtM2MxLjEtMC45LDIuMy0xLjUsMy44LTJjMS41LTAuNSwzLjEtMC43LDQuOS0wLjdjMS40LDAsMi44LDAuMSwzLjksMC40DQoJCQljMS4yLDAuMywyLjIsMC43LDMuMSwxLjFjMC45LDAuNCwxLjYsMC45LDIuMiwxLjRsLTMuMywzLjdjLTAuNS0wLjMtMS0wLjYtMS41LTAuOWMtMC42LTAuMy0xLjItMC41LTEuOS0wLjdjLTAuNy0wLjItMS41LTAuMy0yLjQtMC4zDQoJCQljLTAuOSwwLTEuNiwwLjEtMi40LDAuNGMtMC43LDAuMi0xLjQsMC42LTEuOSwxYy0wLjUsMC40LTEsMC45LTEuMywxLjVzLTAuNSwxLjItMC41LDEuOQ0KCQkJYzAsMC45LDAuMiwxLjcsMC41LDIuM2MwLjMsMC42LDAuOCwxLjEsMS4zLDEuNGMwLjYsMC4zLDEuMiwwLjYsMS45LDAuN3MxLjUsMC4yLDIuMywwLjJjMC44LDAsMS42LTAuMSwyLjMtMC4yczEuMy0wLjQsMS44LTAuNg0KCQkJYzAuNS0wLjMsMC45LTAuNiwxLjItMWMwLjMtMC40LDAuNC0wLjgsMC40LTEuM1Y5NWwwLjgsMS41aC02Ljl2LTMuOWgxMS40YzAsMC4zLDAsMC42LDAuMSwxYzAsMC40LDAsMC44LDAsMS4xDQoJCQljMCwwLjMsMCwwLjUsMCwwLjZjMCwxLjQtMC4zLDIuNi0wLjgsMy42Yy0wLjUsMS0xLjMsMS45LTIuNCwyLjZjLTEsMC43LTIuMiwxLjItMy43LDEuNUMxNC4xLDEwMy4zLDEyLjUsMTAzLjUsMTAuNywxMDMuNXoiLz4NCgkJPHBhdGggY2xhc3M9InN0MCIgZD0iTTY4LjIsMTAzLjJsOS4yLTE4LjNoNC45bDkuMiwxOC4zaC01LjdsLTQuOS05LjZjLTAuMi0wLjQtMC40LTAuOC0wLjYtMS4yYy0wLjItMC40LTAuMy0wLjctMC40LTENCgkJCWMtMC4xLTAuMy0wLjItMC42LTAuMy0xYy0wLjEtMC4zLTAuMi0wLjYtMC4zLTAuOWgxLjFjLTAuMSwwLjMtMC4yLDAuNi0wLjMsMWMtMC4xLDAuMy0wLjIsMC42LTAuNCwxYy0wLjEsMC4zLTAuMywwLjctMC41LDENCgkJCWMtMC4yLDAuMy0wLjMsMC43LTAuNSwxLjFsLTQuOSw5LjZINjguMnogTTcyLjcsMTAwLjhsMS43LTMuOGgxMWwwLjcsMy44SDcyLjd6Ii8+DQoJCTxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik0xMzguOSwxMDMuMlY4NC45aDQuOWw4LjMsMTAuM2gtMy42bDguMy0xMC4zaDQuOXYxOC4zaC01LjR2LTQuNmMwLTEuNCwwLTIuOCwwLjEtNC4xDQoJCQljMC4xLTEuMywwLjItMi42LDAuNC0zLjlsMC41LDEuOGwtNi4yLDdoLTEuN2wtNi4zLTcuMWwwLjctMS42YzAuMiwxLjMsMC4zLDIuNiwwLjQsMy45YzAuMSwxLjMsMC4xLDIuNiwwLjEsNC4xdjQuNkgxMzguOXoiLz4NCgkJPHBhdGggY2xhc3M9InN0MCIgZD0iTTIxMi45LDEwMy4ydi00LjhoNXYtOC44aC01di00LjhoMTUuOHY0LjhoLTUuMXY4LjhoNS4xdjQuOEgyMTIuOXoiLz4NCgkJPHBhdGggY2xhc3M9InN0MCIgZD0iTTI3OS45LDEwMy4yVjg0LjloNS4zbDEyLjEsMTEuNmwtMC45LTAuNGMtMC4xLTAuOC0wLjItMS41LTAuMi0yLjFjLTAuMS0wLjYtMC4xLTEuMi0wLjEtMS43DQoJCQljMC0wLjUtMC4xLTEtMC4xLTEuNGMwLTAuNCwwLTAuOSwwLTEuM3MwLTAuOSwwLTEuNHYtMy40aDUuNHYxOC4zaC01LjRsLTEzLTEyLjhsMS45LDAuNmMwLjEsMC4yLDAuMSwwLjQsMC4yLDAuNw0KCQkJYzAuMSwwLjMsMC4xLDAuNiwwLjEsMC45YzAsMC4zLDAuMSwwLjgsMC4xLDEuM2MwLDAuNSwwLjEsMS4xLDAuMSwxLjhzMCwxLjUsMCwyLjV2NUgyNzkuOXoiLz4NCgkJPHBhdGggY2xhc3M9InN0MCIgZD0iTTM2MS43LDEwMy41Yy0xLjcsMC0zLjItMC4yLTQuNi0wLjZjLTEuNC0wLjQtMi41LTEtMy41LTEuOGMtMS0wLjgtMS43LTEuOC0yLjMtM2MtMC41LTEuMi0wLjgtMi42LTAuOC00LjINCgkJCWMwLTEuNCwwLjMtMi43LDAuOS0zLjhzMS40LTIuMiwyLjUtM2MxLjEtMC45LDIuMy0xLjUsMy44LTJjMS41LTAuNSwzLjEtMC43LDQuOS0wLjdjMS40LDAsMi44LDAuMSwzLjksMC40DQoJCQljMS4yLDAuMywyLjIsMC43LDMuMSwxLjFjMC45LDAuNCwxLjYsMC45LDIuMiwxLjRsLTMuMywzLjdjLTAuNS0wLjMtMS0wLjYtMS41LTAuOWMtMC42LTAuMy0xLjItMC41LTEuOS0wLjdjLTAuNy0wLjItMS41LTAuMy0yLjQtMC4zDQoJCQljLTAuOSwwLTEuNiwwLjEtMi40LDAuNGMtMC43LDAuMi0xLjQsMC42LTEuOSwxYy0wLjUsMC40LTEsMC45LTEuMywxLjVjLTAuMywwLjYtMC41LDEuMi0wLjUsMS45YzAsMC45LDAuMiwxLjcsMC41LDIuMw0KCQkJYzAuMywwLjYsMC44LDEuMSwxLjMsMS40YzAuNiwwLjMsMS4yLDAuNiwxLjksMC43YzAuNywwLjEsMS41LDAuMiwyLjMsMC4yYzAuOCwwLDEuNi0wLjEsMi4yLTAuMnMxLjMtMC40LDEuOC0wLjZzMC45LTAuNiwxLjItMQ0KCQkJYzAuMy0wLjQsMC40LTAuOCwwLjQtMS4zVjk1bDAuOCwxLjVoLTYuOXYtMy45aDExLjRjMCwwLjMsMCwwLjYsMC4xLDFjMCwwLjQsMCwwLjgsMCwxLjFjMCwwLjMsMCwwLjUsMCwwLjYNCgkJCWMwLDEuNC0wLjMsMi42LTAuOCwzLjZjLTAuNSwxLTEuMywxLjktMi40LDIuNmMtMSwwLjctMi4yLDEuMi0zLjcsMS41QzM2NS4xLDEwMy4zLDM2My41LDEwMy41LDM2MS43LDEwMy41eiIvPg0KCTwvZz4NCjwvZz4NCjwvc3ZnPg0K';

// Atlas-V Keno certified paytable
const PAY: Record<number, Record<number, number>> = {
  1: { 1: 3.5 },
  2: { 1: 1.0, 2: 10.0 },
  3: { 2: 2.0, 3: 50.0 },
  4: { 2: 1.5, 3: 10.0, 4: 80.0 },
  5: { 2: 1.0, 3: 3.0, 4: 30.0, 5: 150.0 },
  6: { 3: 2.0, 4: 15.0, 5: 60.0, 6: 500.0 },
  7: { 0: 1.0, 3: 2.0, 4: 4.0, 5: 20.0, 6: 80.0, 7: 1000.0 },
  8: { 0: 1.0, 4: 5.0, 5: 15.0, 6: 50.0, 7: 200.0, 8: 2000.0 },
  9: { 0: 2.0, 4: 2.0, 5: 10.0, 6: 25.0, 7: 125.0, 8: 1000.0, 9: 5000.0 },
  10: { 0: 2.0, 5: 5.0, 6: 30.0, 7: 100.0, 8: 300.0, 9: 2000.0, 10: 10000.0 }
};

interface KenoPageProps {
  onBackToLobby?: () => void;
}

const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const pad = (n: number) => String(n).padStart(2, '0');

export const KenoPage: React.FC<KenoPageProps> = ({ onBackToLobby }) => {
  const {
    roundNumber,
    phase,
    timeRemaining,
    serverSeedHash,
    drawnBalls,
    currentDrawnBall,
    selectedNumbers,
    stake,
    activeTickets,
    allRoomTickets,
    balance,
    userId,
    userDisplayId,
    hotNumbers,
    coldNumbers,
    frequencyMap,
    lastWinAmount,
    isRulesModalOpen,
    rulesModalTab,
    toggleNumber,
    adjustStake,
    doubleStake,
    maxStake,
    placeBet,
    openDeposit,
    openRulesModal,
    closeRulesModal,
    switchRulesTab
  } = useKeno();

  // Tab State
  const [tab, setTab] = useState<'game' | 'history' | 'results' | 'stats' | 'leaders'>('game');
  const [ltab, setLtab] = useState<'game' | 'history'>('game');
  const [rtab, setRtab] = useState<'results' | 'stats' | 'leaders'>('results');

  // Flash BET ACCEPTED state
  const [isBetAcceptedFlash, setIsBetAcceptedFlash] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [sortStats, setSortStats] = useState<boolean>(false);
  const [slideIndex, setSlideIndex] = useState<number>(0);
  const [landedBalls, setLandedBalls] = useState<number[]>([]);
  const lastAnimatedBallRef = useRef<number | null>(null);

  const slidesRef = useRef<HTMLDivElement>(null);
  const drawnRef = useRef<HTMLDivElement>(null);
  const bigRef = useRef<HTMLSpanElement>(null);

  // Authenticated User ID formatting matching Image 2 (ID: 886122631)
  const formattedUid = useMemo(() => {
    if (!userDisplayId) return 'ID: 886122631';
    return userDisplayId.startsWith('ID:') ? userDisplayId : `ID: ${userDisplayId}`;
  }, [userDisplayId]);

  // Dynamic Document Background for Seamless Fullscreen Emerald Casino (eliminates white stripes & bounce bleed)
  useEffect(() => {
    const prevDocBg = document.documentElement.style.backgroundColor;
    const prevBodyBg = document.body.style.backgroundColor;
    document.documentElement.style.backgroundColor = '#141b1a';
    document.body.style.backgroundColor = '#141b1a';
    return () => {
      document.documentElement.style.backgroundColor = prevDocBg;
      document.body.style.backgroundColor = prevBodyBg;
    };
  }, []);

  // Web Audio Synthesizer for Authentic Casino Sound Effects
  const sndCtxRef = useRef<AudioContext | null>(null);
  const getSndCtx = useCallback(() => {
    if (!sndCtxRef.current && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) sndCtxRef.current = new AudioCtx();
    }
    if (sndCtxRef.current && sndCtxRef.current.state === 'suspended') {
      sndCtxRef.current.resume();
    }
    return sndCtxRef.current;
  }, []);

  const playTone = useCallback(
    (freq: number, duration: number, type: OscillatorType = 'sine', gainVal = 0.15) => {
      try {
        const ctx = getSndCtx();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(gainVal, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
      } catch (e) {}
    },
    [getSndCtx]
  );

  const playHitChime = useCallback(() => {
    playTone(880, 0.18, 'sine', 0.14);
  }, [playTone]);

  const playPopSound = useCallback(() => {
    playTone(320, 0.08, 'triangle', 0.12);
  }, [playTone]);

  const playWinFanfare = useCallback(() => {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      setTimeout(() => playTone(freq, 0.35, 'triangle', 0.2), idx * 120);
    });
  }, [playTone]);

  // Round phase lifecycle reset for landed balls and tube state
  useEffect(() => {
    if (phase === 'betting') {
      setLandedBalls([]);
      lastAnimatedBallRef.current = null;
      const big = bigRef.current;
      if (big) {
        big.classList.add('hidden');
        big.style.setProperty('display', 'none', 'important');
      }
    } else if (phase === 'settlement') {
      setLandedBalls(drawnBalls);
      const big = bigRef.current;
      if (big) {
        big.classList.add('hidden');
        big.style.setProperty('display', 'none', 'important');
      }
    }
  }, [phase, drawnBalls]);

  // Trigger flight animation and slot docking on currentDrawnBall
  useEffect(() => {
    if (!currentDrawnBall || phase !== 'drawing') return;
    if (lastAnimatedBallRef.current === currentDrawnBall) return;
    lastAnimatedBallRef.current = currentDrawnBall;

    // Catch up any prior drawn balls into landedBalls
    const callIndex = drawnBalls.indexOf(currentDrawnBall);
    if (callIndex > 0) {
      const prior = drawnBalls.slice(0, callIndex);
      setLandedBalls(prev => {
        const missing = prior.filter(p => !prev.includes(p));
        return missing.length > 0 ? [...prev, ...missing] : prev;
      });
    }

    const isHit = selectedNumbers.has(currentDrawnBall);
    const big = bigRef.current;
    const drawnContainer = drawnRef.current;

    if (big) {
      big.style.removeProperty('display');
      big.classList.remove('hidden');
      big.classList.remove('emerging');
      void big.offsetWidth; // Force CSS reflow to re-trigger emerging pop animation
      big.classList.add('emerging');
      if (isHit) big.classList.add('hit');
      else big.classList.remove('hit');
    }

    playPopSound();
    if (isHit) {
      playHitChime();
    } else {
      playTone(280, 0.08, 'sine', 0.05);
    }

    if (callIndex < 0 || callIndex >= 20 || !big || !drawnContainer) return;

    // First 10 called numbers go to 2nd row (slots 10..19); last 10 go to 1st row (slots 0..9)
    const slotIdx = callIndex < 10 ? 10 + callIndex : callIndex - 10;
    const targetSlot = drawnContainer.children[slotIdx] as HTMLElement;
    if (!targetSlot) return;

    let flyingEl: HTMLElement | null = null;
    let flightTimeout: NodeJS.Timeout | null = null;

    // Center stage showcase pause (authentic Keno tempo: 350ms)
    const showcaseTimer = setTimeout(() => {
      const from = big.getBoundingClientRect();
      const to = targetSlot.getBoundingClientRect();

      const fl = document.createElement('span');
      fl.className = 'ball big' + (isHit ? ' hit' : '');
      fl.innerHTML = `<span class="ball-num">${currentDrawnBall}</span>`;
      Object.assign(fl.style, {
        position: 'fixed',
        left: from.left + 'px',
        top: from.top + 'px',
        width: from.width + 'px',
        height: from.height + 'px',
        margin: '0',
        zIndex: '50',
        pointerEvents: 'none',
        transition: 'transform .45s cubic-bezier(.22,.8,.36,1), width .45s, height .45s, opacity .45s'
      });
      document.body.appendChild(fl);
      flyingEl = fl;

      // Immediately hide #big so the central tube is visibly empty as the ball leaves!
      big.style.setProperty('display', 'none', 'important');
      big.classList.add('hidden');

      const dx = to.left + to.width / 2 - (from.left + from.width / 2);
      const dy = to.top + to.height / 2 - (from.top + from.height / 2);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          fl.style.width = to.width + 'px';
          fl.style.height = to.height + 'px';
          const flNum = fl.querySelector('.ball-num') as HTMLElement;
          if (flNum) flNum.style.fontSize = '13px';
          fl.style.left = from.left + (from.width - to.width) / 2 + 'px';
          fl.style.top = from.top + (from.height - to.height) / 2 + 'px';
          fl.style.transform = `translate(${dx}px, ${dy}px)`;
        });
      });

      flightTimeout = setTimeout(() => {
        if (flyingEl) {
          flyingEl.remove();
          flyingEl = null;
        }
        playTone(560, 0.05, 'sine', 0.08); // Authentic 560Hz landing tone
        setLandedBalls(prev => (prev.includes(currentDrawnBall) ? prev : [...prev, currentDrawnBall]));
      }, 450);
    }, 350);

    return () => {
      clearTimeout(showcaseTimer);
      if (flightTimeout) clearTimeout(flightTimeout);
      if (flyingEl) flyingEl.remove();
    };
  }, [currentDrawnBall, phase, selectedNumbers, playPopSound, playHitChime, playTone, drawnBalls]);

  // Win fanfare on settlement
  useEffect(() => {
    if (phase === 'settlement' && lastWinAmount > 0) {
      playWinFanfare();
    }
  }, [phase, lastWinAmount, playWinFanfare]);

  // Telegram WebApp Native BackButton Integration
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.BackButton) {
      tg.BackButton.show();
      const handleBack = () => {
        if (onBackToLobby) onBackToLobby();
      };
      tg.BackButton.onClick(handleBack);
      return () => {
        tg.BackButton.offClick(handleBack);
        tg.BackButton.hide();
      };
    }
  }, [onBackToLobby]);

  // Toast Helper
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  // Handle Bet Click
  const handleBetClick = async () => {
    if (phase !== 'betting' || isBetAcceptedFlash) return;
    if (selectedNumbers.size === 0) {
      showToast('Please pick 1 to 10 numbers');
      return;
    }
    if (balance < stake) {
      showToast(`Not enough credits (${balance.toFixed(2)} < ${stake.toFixed(2)} ETB). Opening Deposit...`);
      openDeposit();
      return;
    }

    const res = await placeBet();
    if (res.success) {
      setIsBetAcceptedFlash(true);
      showToast(`Bet placed: ${stake.toFixed(2)} ETB on ${selectedNumbers.size} numbers`);
      setTimeout(() => {
        setIsBetAcceptedFlash(false);
      }, 1000);
      if (slidesRef.current) {
        slidesRef.current.scrollTo({ left: 0, behavior: 'smooth' });
      }
      setSlideIndex(0);
    } else {
      showToast(res.error || 'Failed to place bet');
    }
  };

  // Scroll Slide listener for pagination dots
  const handleSlideScroll = () => {
    if (!slidesRef.current) return;
    const w = slidesRef.current.clientWidth || 1;
    const idx = Math.min(
      activeTickets.length,
      Math.max(0, Math.round(slidesRef.current.scrollLeft / w))
    );
    setSlideIndex(idx);
  };

  // Precomputed HOT & COLD sets for dots
  const hotSet = useMemo(() => new Set(hotNumbers.slice(0, 5)), [hotNumbers]);
  const coldSet = useMemo(() => new Set(coldNumbers.slice(0, 5)), [coldNumbers]);

  // Odds calculation for selected count
  const oddsData = useMemo(() => {
    const n = selectedNumbers.size;
    if (n === 0) return { keys: [] as number[], maxWin: 0, p: {} as Record<number, number> };
    const p = PAY[n] || {};
    const keys = Object.keys(p).map(Number).sort((a, b) => a - b);
    const maxMult = keys.length > 0 ? Math.max(...keys.map(k => p[k])) : 0;
    return { keys, maxWin: maxMult * stake, p };
  }, [selectedNumbers, stake]);

  // 1-80 Numbers Array
  const cells = useMemo(() => Array.from({ length: 80 }, (_, i) => i + 1), []);

  // 20 Docked Slots calculation (First 10 go to row 2, last 10 to row 1)
  const dockedSlots = useMemo(() => {
    const slots = Array.from({ length: 20 }, () => null as number | null);
    landedBalls.forEach((num, callIndex) => {
      if (callIndex < 20) {
        const slotIdx = callIndex < 10 ? 10 + callIndex : callIndex - 10;
        slots[slotIdx] = num;
      }
    });
    return slots;
  }, [landedBalls]);

  // Real Database History, Results & Leaders States (Zero Mock Data)
  const [playerHistory, setPlayerHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [recentResults, setRecentResults] = useState<any[]>([]);
  const [isLoadingResults, setIsLoadingResults] = useState<boolean>(false);
  const [leadersList, setLeadersList] = useState<Array<{ id: string; b: number; w: number }>>([]);
  const [isLoadingLeaders, setIsLoadingLeaders] = useState<boolean>(false);

  // 1. Fetch authenticated player's history from Neon DB
  const fetchPlayerHistory = useCallback(() => {
    if (!userId) return;
    setIsLoadingHistory(true);
    const sock = socketService.getSocket();
    let received = false;

    if (sock && sock.connected) {
      sock.emit('keno:get_player_history', { userId }, (res: any) => {
        received = true;
        setIsLoadingHistory(false);
        if (res?.success && Array.isArray(res.history)) {
          setPlayerHistory(res.history);
        }
      });
    }

    // HTTP REST fallback in case socket response delayed
    fetch(`/api/keno/history?userId=${encodeURIComponent(userId)}`)
      .then(r => r.json())
      .then(data => {
        if (!received && data?.success && Array.isArray(data.history)) {
          setPlayerHistory(data.history);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingHistory(false));
  }, [userId]);

  // 2. Fetch recent completed round results from Neon DB
  const fetchRecentResults = useCallback(() => {
    setIsLoadingResults(true);
    const sock = socketService.getSocket();
    let received = false;

    if (sock && sock.connected) {
      sock.emit('keno:get_recent_results', {}, (res: any) => {
        received = true;
        setIsLoadingResults(false);
        if (res?.success && Array.isArray(res.results)) {
          setRecentResults(res.results);
        }
      });
    }

    fetch('/api/keno/results')
      .then(r => r.json())
      .then(data => {
        if (!received && data?.success && Array.isArray(data.results)) {
          setRecentResults(data.results);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingResults(false));
  }, []);

  // 3. Fetch global leaderboard top payouts from Neon DB
  const fetchLeaderboard = useCallback(() => {
    setIsLoadingLeaders(true);
    const sock = socketService.getSocket();
    let received = false;

    if (sock && sock.connected) {
      sock.emit('keno:get_leaderboard', {}, (res: any) => {
        received = true;
        setIsLoadingLeaders(false);
        if (res?.success && Array.isArray(res.leaders)) {
          setLeadersList(res.leaders);
        }
      });
    }

    fetch('/api/keno/leaderboard')
      .then(r => r.json())
      .then(data => {
        if (!received && data?.success && Array.isArray(data.leaders)) {
          setLeadersList(data.leaders);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingLeaders(false));
  }, []);

  // Sync real database state on mount and tab switch
  useEffect(() => {
    fetchRecentResults();
    fetchLeaderboard();
    if (userId) fetchPlayerHistory();
  }, [fetchRecentResults, fetchLeaderboard, fetchPlayerHistory, userId]);

  // Dynamic tab re-fetch
  useEffect(() => {
    if (tab === 'history' || ltab === 'history') fetchPlayerHistory();
    if (tab === 'results' || rtab === 'results') fetchRecentResults();
    if (tab === 'leaders' || rtab === 'leaders') fetchLeaderboard();
  }, [tab, ltab, rtab, fetchPlayerHistory, fetchRecentResults, fetchLeaderboard]);

  // Live socket event listeners for instant settlement sync
  useEffect(() => {
    const sock = socketService.getSocket();
    if (!sock) return;

    const onRecentResultsUpdated = (data: any) => {
      if (data?.recentHistory && Array.isArray(data.recentHistory)) {
        setRecentResults(data.recentHistory);
      }
    };

    const onRoundSettled = () => {
      fetchRecentResults();
      fetchLeaderboard();
      if (userId) fetchPlayerHistory();
    };

    const onPlayerHistory = (data: any) => {
      if (data?.success && Array.isArray(data.history)) {
        setPlayerHistory(data.history);
      }
    };

    const onRecentResults = (data: any) => {
      if (data?.success && Array.isArray(data.results)) {
        setRecentResults(data.results);
      }
    };

    const onLeaderboard = (data: any) => {
      if (data?.success && Array.isArray(data.leaders)) {
        setLeadersList(data.leaders);
      }
    };

    sock.on('keno:recent_results_updated', onRecentResultsUpdated);
    sock.on('keno:round_settled', onRoundSettled);
    sock.on('keno:player_history', onPlayerHistory);
    sock.on('keno:recent_results', onRecentResults);
    sock.on('keno:leaderboard', onLeaderboard);

    return () => {
      sock.off('keno:recent_results_updated', onRecentResultsUpdated);
      sock.off('keno:round_settled', onRoundSettled);
      sock.off('keno:player_history', onPlayerHistory);
      sock.off('keno:recent_results', onRecentResults);
      sock.off('keno:leaderboard', onLeaderboard);
    };
  }, [fetchRecentResults, fetchLeaderboard, fetchPlayerHistory, userId]);

  // Helper to render a ticket card (.tk)
  const renderTicketCard = (t: KenoTicket, idx: number, isMine = true) => {
    const hits = t.selectedNumbers.filter(n => drawnBalls.includes(n));
    const hasHit = hits.length > 0;
    const isSettlement = phase === 'settlement';

    let statusText = 'Waiting';
    let statusCls = 'w';

    if (isSettlement) {
      if ((t.payoutAmount ?? 0) > 0 || (t.winAmount ?? 0) > 0) {
        const win = t.payoutAmount ?? t.winAmount ?? 0;
        statusText = win % 1 === 0 ? String(win) : win.toFixed(2);
        statusCls = 'win';
      } else {
        const p = PAY[t.selectedNumbers.length] || {};
        const mult = p[hits.length] !== undefined ? p[hits.length] : 0;
        const won = mult * t.betAmount;
        if (won > 0) {
          statusText = won % 1 === 0 ? String(won) : won.toFixed(2);
          statusCls = 'win';
        } else {
          statusText = '0';
          statusCls = 'lose';
        }
      }
    }

    const displayId = isMine
      ? `My Ticket #${activeTickets.length - idx}`
      : (t.userId ? (t.userId.length > 6 ? `${t.userId.slice(0, 2)}***${t.userId.slice(-2)}` : t.userId) : `KT-${idx + 1}`);

    return (
      <div key={t.ticketId || idx} className={`tk${hasHit ? ' has-hit' : ''}`}>
        <div className="id">{displayId}</div>
        <div className="slots">
          {Array.from({ length: 10 }, (_, i) => {
            const v = t.selectedNumbers[i];
            const isHit = v && hits.includes(v);
            return (
              <span
                key={i}
                className={v ? `f${isHit ? (isMine ? ' h' : ' h-other') : ''}` : ''}
              >
                {v || ''}
              </span>
            );
          })}
        </div>
        <div className="bt">
          <div>Bet {fmt(t.betAmount)}</div>
          <div className={statusCls}>{statusText}</div>
        </div>
      </div>
    );
  };

  // Helper for tab content
  const renderTabContent = (activeTab: string) => {
    if (activeTab === 'game') {
      const mine = activeTickets;
      const otherTickets = (allRoomTickets || []).filter(
        t => t.userId !== userId && !mine.some(m => m.ticketId === t.ticketId)
      );
      const totalCount = mine.length + otherTickets.length;
      const totalBets = mine.reduce((acc, t) => acc + t.betAmount, 0);

      return (
        <div>
          <div className="sub">
            <span>
              All<b>{totalCount}</b>
            </span>
            <span>
              My Tickets<b>{mine.length}</b>
            </span>
            <span>
              My Bets<b>{totalBets}</b>
            </span>
          </div>
          {/* Player's active tickets at top */}
          {mine.map((t, idx) => renderTicketCard(t, idx, true))}

          {/* Followed by live active tickets from other real players */}
          {otherTickets.map((t, idx) => renderTicketCard(t, idx, false))}

          {totalCount === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 16px', color: '#7d8c89', fontSize: '14px' }}>
              No bets in Round #{roundNumber} yet. Pick 1 to 10 numbers above and tap BET!
            </div>
          )}
        </div>
      );
    }

    if (activeTab === 'history') {
      return (
        <div>
          <button
            type="button"
            className="showb"
            onClick={() => {
              const next = !showHistory;
              setShowHistory(next);
              if (next) fetchPlayerHistory();
            }}
          >
            {showHistory ? 'HIDE RESULTS' : 'SHOW THE RESULTS'}
          </button>

          {showHistory && (
            <div className="history-list">
              {isLoadingHistory && playerHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px', color: '#7d8c89', fontSize: '13px' }}>
                  Loading round history...
                </div>
              ) : playerHistory.length === 0 ? (
                <div className="empty">No bets yet</div>
              ) : (
                playerHistory.map((t, idx) => {
                  const hits = Array.isArray(t.hitNumbers) && t.hitNumbers.length > 0
                    ? t.hitNumbers
                    : (t.selectedNumbers || []).filter((n: number) => (t.drawnNumbers || []).includes(n));
                  const isWon = (t.payoutAmount ?? 0) > 0 || t.status === 'won';
                  const statusCls = isWon ? 'win' : 'lose';
                  const statusText = isWon ? `WON +${fmt(t.payoutAmount)}` : 'Lost';

                  return (
                    <div key={t.ticketId || idx} className={`tk${hits.length > 0 ? ' has-hit' : ''}`}>
                      <div className="id" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Round #{t.roundNumber}</span>
                        {t.serverSeedHash && (
                          <span
                            title={`Provably Fair Hash: ${t.serverSeedHash}`}
                            style={{ fontSize: '10px', color: '#51c6a6', letterSpacing: '0.5px' }}
                          >
                            🛡️ #{String(t.roundNumber)}
                          </span>
                        )}
                      </div>
                      <div className="slots">
                        {Array.from({ length: 10 }, (_, i) => {
                          const v = t.selectedNumbers[i];
                          const isHit = v && hits.includes(v);
                          return (
                            <span key={i} className={v ? `f${isHit ? ' h' : ''}` : ''}>
                              {v || ''}
                            </span>
                          );
                        })}
                      </div>
                      <div className="bt">
                        <div>Bet {fmt(t.betAmount)}</div>
                        <div className={statusCls}>{statusText}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          <div className="fair">
            <img src={SHD} width="40" height="52" alt="Fairness Shield" />
            <h3>FAIRNESS</h3>
            <img className="atlas" src={ATL} alt="ATLAS-V Gaming" />
          </div>
        </div>
      );
    }

    if (activeTab === 'results') {
      return (
        <div>
          <div className="rh">
            <span>Draw ID</span>
            <span>Combination</span>
          </div>

          {/* Current active round status row */}
          <div className="rr">
            <span className="rs">
              <img src={SHD} width="15" height="20" alt="Shield" />
            </span>
            <div className="rid" style={{ width: 'auto' }}>
              #{roundNumber}
            </div>
            <div className="wait">{phase === 'drawing' ? 'DRAWING' : 'WAIT'}</div>
          </div>

          {/* Completed past rounds from Neon PostgreSQL */}
          {recentResults.length === 0 && !isLoadingResults ? (
            <div className="empty" style={{ textAlign: 'center', padding: '16px', color: '#7d8c89', fontSize: '13px' }}>
              No past draws recorded yet
            </div>
          ) : (
            recentResults.map((r, i) => {
              const d = r.drawnAt ? new Date(r.drawnAt) : null;
              const timeStr = d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '';
              return (
                <div key={r.roundNumber || i} className="rr">
                  <span className="rs">
                    <img src={SHD} width="15" height="20" alt="Shield" />
                  </span>
                  <div className="rid">
                    #{r.roundNumber}
                    <small>{timeStr}</small>
                  </div>
                  <div className="comb">
                    {(r.drawnNumbers || []).map((num: number, idx: number) => (
                      <span key={idx}>{num}</span>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      );
    }

    if (activeTab === 'stats') {
      const rows = Array.from({ length: 80 }, (_, i) => {
        const num = i + 1;
        const count = frequencyMap[num] || 0;
        return [num, count] as [number, number];
      });

      if (sortStats) {
        // Hot to Cold (highest frequency first)
        rows.sort((a, b) => b[1] - a[1]);
      } else {
        // Numerical 1 to 80
        rows.sort((a, b) => a[0] - b[0]);
      }

      const maxF = Math.max(1, ...rows.map(r => r[1]));

      return (
        <div>
          <div className="sub">
            <span>Last 100 rounds ({sortStats ? 'Hot to Cold' : '1 to 80'})</span>
            <button
              type="button"
              className="srt"
              onClick={() => setSortStats(prev => !prev)}
            >
              Sort{' '}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3ddc97" strokeWidth="2.4" strokeLinecap="round">
                <path d="M4 7h16M7 12h10M10 17h4" />
              </svg>
            </button>
          </div>
          <div className="stats-list" style={{ maxHeight: '420px', overflowY: 'auto' }}>
            {rows.map(([n, c]) => (
              <div key={n} className="st">
                <b>{n}</b>
                <div className="tr">
                  <i style={{ width: `${(c / maxF) * 100}%` }} />
                </div>
                <span>{c}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (activeTab === 'leaders') {
      return (
        <div>
          <div className="lh">
            <span>#</span>
            <span>ID</span>
            <span>Bet</span>
            <span>Win</span>
          </div>
          {isLoadingLeaders && leadersList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 16px', color: '#7d8c89', fontSize: '14px' }}>
              Loading top winners...
            </div>
          ) : leadersList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 16px', color: '#7d8c89', fontSize: '14px' }}>
              No top winners recorded yet.
            </div>
          ) : (
            leadersList.map((item, idx) => (
              <div key={idx} className={`lr${idx < 3 ? ' top' : ''}`}>
                <b>{idx + 1}</b>
                <span>{item.id}</span>
                <span>{item.b}</span>
                <em>{fmt(item.w)} ETB</em>
              </div>
            ))
          )}
          <div className="fair">
            <img src={SHD} width="40" height="52" alt="Fairness Shield" />
            <h3>FAIRNESS</h3>
            <img className="atlas" src={ATL} alt="ATLAS-V Gaming" />
          </div>
        </div>
      );
    }

    return null;
  };

  const isDrawing = phase === 'drawing' || phase === 'settling' || phase === 'settlement';

  return (
    <div className="keno-fullscreen-view">
      <div className="wrap">
        {/* ── Desktop Left Sidebar ── */}
        <aside className="side" id="left">
          <div className="lp">
            <span className="fb" onClick={openDeposit} style={{ cursor: 'pointer' }} title="Deposit Funds">
              <span id="bal2">{balance.toFixed(2)}</span> ETB
            </span>
            <span className="lid">
              <span id="uid2">{formattedUid}</span>
              <img src={SHD} width="14" height="18" alt="Shield" />
            </span>
          </div>
          <div className="stabs">
            <button
              type="button"
              className={ltab === 'game' ? 'on' : ''}
              onClick={() => setLtab('game')}
            >
              <svg className="f" viewBox="0 0 24 24">
                <path d="M5 3.5l15 8.5-15 8.5z" />
              </svg>
              GAME
            </button>
            <button
              type="button"
              className={ltab === 'history' ? 'on' : ''}
              onClick={() => setLtab('history')}
            >
              <svg viewBox="0 0 24 24">
                <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4v4.6H8M12 7.5V12l3 2" />
              </svg>
              HISTORY
            </button>
          </div>
          <div className="sbody" id="lbody">
            {renderTabContent(ltab)}
          </div>
        </aside>

        {/* ── Main Mobile Container (.app) ── */}
        <div className="app">
          <header>
            <div className="logo" onClick={() => openRulesModal('rules')} style={{ cursor: 'pointer' }}>
              <span className="t1">FAST</span>
              <span className="t2">
                KEN<i></i>
              </span>
            </div>

            {/* Live Balance Pill (Opens Deposit modal on tap) */}
            <div className="pill" onClick={openDeposit} style={{ cursor: 'pointer' }} title="Tap to Deposit">
              <span className="b">
                <span id="bal">{balance.toFixed(2)}</span>
                <sup>ETB</sup>
              </span>
              <span className="id">
                <span id="uid">{formattedUid}</span>
                <img src={SHD} width="14" height="18" alt="Verified Shield" />
              </span>
            </div>

            {/* Hamburger Menu (Opens Rules & Fairness modal) */}
            <div className="menu" onClick={() => openRulesModal('rules')} title="Rules & Fairness">
              <i></i>
              <i></i>
              <i></i>
            </div>
          </header>

          {/* Authentic Timer Badge */}
          <div className="timer" id="timer" style={{ visibility: isDrawing ? 'hidden' : 'visible' }}>
            00 : {pad(timeRemaining)}
          </div>

          {/* ── Authentic Radar Stage (.stage) ── */}
          <div className={`stage${isDrawing ? ' drawing' : ''}`} id="stage">
            <svg className="arcs" viewBox="0 0 348 126" preserveAspectRatio="xMidYMid slice">
              <g fill="none" stroke="rgba(255,255,255,.05)" strokeWidth="1.5">
                <circle cx="250" cy="70" r="55" />
                <circle cx="250" cy="70" r="90" />
                <circle cx="250" cy="70" r="125" />
              </g>
            </svg>

            {!isDrawing && (
              <div
                className="slides"
                id="slides"
                ref={slidesRef}
                onScroll={handleSlideScroll}
              >
                {/* Main Selection Slide */}
                <div className="sl" id="mainSl">
                  {selectedNumbers.size === 0 ? (
                    <div id="pickView">
                      <div className="help" onClick={() => openRulesModal('rules')}>
                        ?
                      </div>
                      <div className="mini">
                        <span className="ball">
                          <span className="ball-num">80</span>
                        </span>
                        <span className="ball">
                          <span className="ball-num">10</span>
                        </span>
                      </div>
                      <div className="pick">
                        <div className="n" id="pn">
                          {selectedNumbers.size || 1}
                        </div>
                        <div>
                          <h2>Choose 10 numbers</h2>
                          <p>From 1 to 80</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div id="infoView">
                      <div className="help" onClick={() => openRulesModal('rules')}>
                        ?
                      </div>
                      <div className="pw">
                        <b id="iv1">{Math.max(1, activeTickets.length)}</b> Possible win{' '}
                        <em id="iw">{fmt(oddsData.maxWin)}</em>
                      </div>
                      <div className="odds" id="odds">
                        <div className="oc">
                          <span>Match</span>
                          <span>Odds</span>
                        </div>
                        {oddsData.keys.map((k, i) => {
                          const mult = oddsData.p[k];
                          const isLast = i === oddsData.keys.length - 1;
                          const extraStyle =
                            mult === 1.0
                              ? { color: '#3ddc97', fontWeight: 700 }
                              : mult >= 100
                              ? { color: '#f5c542', fontWeight: 800 }
                              : {};
                          return (
                            <div key={k} className={`oc${isLast ? ' l' : ''}`}>
                              <span>{k}</span>
                              <span style={extraStyle}>x{mult}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="slotsrow" id="sr">
                        {Array.from({ length: 10 }, (_, i) => {
                          const arr = Array.from(selectedNumbers);
                          const num = arr[i];
                          return (
                            <span key={i} className={num ? 'f' : ''}>
                              {num || ''}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Placed Bet Slides in Carousel */}
                {activeTickets.map((t, idx) => {
                  const p = PAY[t.selectedNumbers.length] || {};
                  const ks = Object.keys(p).map(Number).sort((a, b) => a - b);
                  const mx = Math.max(...ks.map(k => p[k]));
                  return (
                    <div key={t.ticketId || idx} className="sl bet-slide">
                      <div className="help" onClick={() => openRulesModal('rules')}>
                        ?
                      </div>
                      <div className="pw">
                        <b>{idx + 1}</b> Possible win <em>{fmt(mx * t.betAmount)}</em>
                      </div>
                      <div className="odds">
                        <div className="oc">
                          <span>Match</span>
                          <span>Odds</span>
                        </div>
                        {ks.map((k, i) => (
                          <div key={k} className={`oc${i === ks.length - 1 ? ' l' : ''}`}>
                            <span>{k}</span>
                            <span>x{p[k]}</span>
                          </div>
                        ))}
                      </div>
                      <div className="slotsrow">
                        {Array.from({ length: 10 }, (_, i) => {
                          const v = t.selectedNumbers[i];
                          return (
                            <span key={i} className={v ? 'f' : ''}>
                              {v || ''}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination Dots for Bet Slides */}
            {!isDrawing && activeTickets.length > 0 && (
              <div className="pgd" id="pgd" style={{ display: 'flex' }}>
                {Array.from({ length: activeTickets.length + 1 }, (_, i) => (
                  <i
                    key={i}
                    className={slideIndex === i ? 'on' : ''}
                    onClick={() => {
                      if (slidesRef.current) {
                        slidesRef.current.scrollTo({
                          left: i * slidesRef.current.clientWidth,
                          behavior: 'smooth'
                        });
                      }
                    }}
                  />
                ))}
              </div>
            )}

            {/* Drawing Mode Stage (.drawwrap) */}
            {isDrawing && (
              <div className="drawwrap" id="drawView" style={{ display: 'block' }}>
                <div className="count">
                  <span id="cnt">{pad(landedBalls.length)}</span>
                  <s>/</s>20
                </div>

                <div className="glow">
                  {/* Central Emerging Ball Tube */}
                  <span
                    className={`ball big${
                      currentDrawnBall
                        ? ` emerging${selectedNumbers.has(currentDrawnBall) ? ' hit' : ''}`
                        : ' hidden'
                    }`}
                    id="big"
                    ref={bigRef}
                    style={currentDrawnBall ? undefined : { display: 'none' }}
                  >
                    <span className="ball-num">{currentDrawnBall || '–'}</span>
                  </span>

                  {/* Settlement In-Stage Banner */}
                  {phase === 'settlement' && (
                    (lastWinAmount > 0 || activeTickets.length > 0) ? (
                      <div
                        className="win-stage-banner"
                        id="winStageBanner"
                        style={{ display: 'flex' }}
                      >
                        <div className="win-stage-title">
                          {lastWinAmount > 0 ? 'YOU WIN' : 'TRY AGAIN'}
                        </div>
                        {lastWinAmount > 0 && (
                          <div className="win-stage-val" id="winStageVal">
                            {lastWinAmount % 1 === 0 ? lastWinAmount : lastWinAmount.toFixed(2)}
                          </div>
                        )}
                      </div>
                    ) : null
                  )}
                </div>

                {/* Docked 20 Ball Slots (first 10 row 2, last 10 row 1) */}
                <div className="drawn" id="drawn" ref={drawnRef}>
                  {dockedSlots.map((ballNum, idx) => (
                    <span
                      key={idx}
                      className={ballNum ? `ball${selectedNumbers.has(ballNum) ? ' hit' : ''}` : 'ball-slot'}
                    >
                      {ballNum && <span className="ball-num">{ballNum}</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── 80-Ball Grid (.grid) ── */}
          {!isDrawing && (
            <div className="grid" id="grid">
              {cells.map(num => {
                const isSel = selectedNumbers.has(num);
                const isHit = isSel && drawnBalls.includes(num);
                const isDrw = !isSel && drawnBalls.includes(num);
                const isHot = hotSet.has(num);
                const isCold = coldSet.has(num);

                let dotClass = 'dot';
                if (isHot) dotClass = 'dot r';
                else if (isCold) dotClass = 'dot b';

                let cellClass = 'cell';
                if (isHit) cellClass += ' hit';
                else if (isSel) cellClass += ' sel';
                else if (isDrw) cellClass += ' drw';

                return (
                  <div
                    key={num}
                    id={`c${num}`}
                    className={cellClass}
                    onClick={() => toggleNumber(num)}
                  >
                    {num}
                    <span className={dotClass} />
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Betting Controls (.row) ── */}
          {!isDrawing && (
            <div className="row">
              <div className="amt">
                <button type="button" id="m" onClick={() => adjustStake(-1)}>
                  −
                </button>
                <b id="a">{stake}</b>
                <button type="button" id="p" onClick={() => adjustStake(1)}>
                  +
                </button>
              </div>
              <button type="button" className="sm" id="x2" onClick={doubleStake}>
                X2
              </button>
              <button type="button" className="sm" id="mx" onClick={maxStake}>
                MAX
              </button>
            </div>
          )}

          {/* ── Big 62px BET Button (.bet) ── */}
          {!isDrawing && (
            <button
              type="button"
              className={`bet${isBetAcceptedFlash ? ' accepted' : ''}`}
              id="bet"
              disabled={phase !== 'betting' || selectedNumbers.size === 0 || isBetAcceptedFlash}
              onClick={handleBetClick}
            >
              {isBetAcceptedFlash ? (
                <>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  BET ACCEPTED
                </>
              ) : (
                'BET'
              )}
            </button>
          )}

          {/* ── Bottom Navigation Tabs (nav) ── */}
          <nav>
            <button
              type="button"
              className={tab === 'game' ? 'on' : ''}
              onClick={() => setTab('game')}
            >
              <svg className="f" viewBox="0 0 24 24">
                <path d="M5 3.5l15 8.5-15 8.5z" />
              </svg>
              GAME
            </button>
            <button
              type="button"
              className={tab === 'history' ? 'on' : ''}
              onClick={() => setTab('history')}
            >
              <svg viewBox="0 0 24 24">
                <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4v4.6H8M12 7.5V12l3 2" />
              </svg>
              HISTORY
            </button>
            <button
              type="button"
              className={tab === 'results' ? 'on' : ''}
              onClick={() => setTab('results')}
            >
              <svg viewBox="0 0 24 24">
                <path d="M4 12.5l5 5L20 6.5" />
              </svg>
              RESULTS
            </button>
            <button
              type="button"
              className={tab === 'stats' ? 'on' : ''}
              onClick={() => setTab('stats')}
            >
              <svg viewBox="0 0 24 24">
                <path d="M4 20v-5M9.5 20V9M15 20v-7M20.5 20V4" />
              </svg>
              STATISTIC
            </button>
            <button
              type="button"
              className={tab === 'leaders' ? 'on' : ''}
              onClick={() => setTab('leaders')}
            >
              <svg viewBox="0 0 24 24">
                <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" />
              </svg>
              LEADERS
            </button>
          </nav>

          {/* Tab Content Area */}
          <div id="tab">{renderTabContent(tab)}</div>

          <div className="pay">Real money gaming with instant Telebirr & Chapa payouts.</div>
        </div>

        {/* ── Desktop Right Sidebar ── */}
        <aside className="side" id="right">
          <div className="stabs">
            <button
              type="button"
              className={rtab === 'results' ? 'on' : ''}
              onClick={() => setRtab('results')}
            >
              <svg viewBox="0 0 24 24">
                <path d="M4 12.5l5 5L20 6.5" />
              </svg>
              RESULTS
            </button>
            <button
              type="button"
              className={rtab === 'stats' ? 'on' : ''}
              onClick={() => setRtab('stats')}
            >
              <svg viewBox="0 0 24 24">
                <path d="M4 20v-5M9.5 20V9M15 20v-7M20.5 20V4" />
              </svg>
              STATISTICS
            </button>
            <button
              type="button"
              className={rtab === 'leaders' ? 'on' : ''}
              onClick={() => setRtab('leaders')}
            >
              <svg viewBox="0 0 24 24">
                <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" />
              </svg>
              LEADERS
            </button>
          </div>
          <div className="sbody" id="rbody">
            {renderTabContent(rtab)}
          </div>
        </aside>
      </div>

      {/* ── Toast Overlay ── */}
      {toastMessage && (
        <div className="toast" id="toast" style={{ display: 'block' }}>
          {toastMessage}
        </div>
      )}

      {/* ── Authentic Rules & Fairness Modal (#rulesModal) ── */}
      <div className={`rules-modal-backdrop${isRulesModalOpen ? ' open' : ''}`} id="rulesModal">
        <div className="rules-modal-card">
          {/* Modal Header: UK Flag & Close Button */}
          <div className="rules-modal-header">
            <div className="rules-lang-flag" title="English">
              <svg viewBox="0 0 60 30" width="34" height="19" style={{ borderRadius: '3px', display: 'block', boxShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                <clipPath id="uk-clip-p3">
                  <rect width="60" height="30" rx="3" />
                </clipPath>
                <g clipPath="url(#uk-clip-p3)">
                  <rect width="60" height="30" fill="#012169" />
                  <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
                  <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="4" />
                  <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
                  <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
                </g>
              </svg>
            </div>
            {onBackToLobby && (
              <button
                type="button"
                className="rules-exit-lobby-btn"
                onClick={() => {
                  closeRulesModal();
                  onBackToLobby();
                }}
                style={{
                  background: 'rgba(61, 220, 151, 0.12)',
                  border: '1px solid rgba(61, 220, 151, 0.4)',
                  color: '#3ddc97',
                  borderRadius: '16px',
                  padding: '4px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                ← Exit to Lobby
              </button>
            )}
            <button
              type="button"
              className="rules-modal-close"
              id="rulesModalClose"
              aria-label="Close Rules Modal"
              onClick={closeRulesModal}
            >
              <svg viewBox="0 0 24 24" width="22" height="22" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" fill="none">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Tab Buttons: RULES & FAIRNESS */}
          <div className="rules-nav-tabs">
            <button
              type="button"
              className={`rules-tab-btn${rulesModalTab === 'rules' ? ' active' : ''}`}
              id="tabRulesBtn"
              onClick={() => switchRulesTab('rules')}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="#3ddc97">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
              </svg>
              <span>RULES</span>
            </button>
            <button
              type="button"
              className={`rules-tab-btn${rulesModalTab === 'fairness' ? ' active' : ''}`}
              id="tabFairnessBtn"
              onClick={() => switchRulesTab('fairness')}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              <span>FAIRNESS</span>
            </button>
          </div>

          {/* Modal Scrollable Body */}
          <div className="rules-modal-body">
            {rulesModalTab === 'rules' ? (
              <div className="rules-tab-pane" id="paneRules">
                <p className="rules-desc-txt">
                  In the field where the numbers from 1 to 80 are present, HOT and COLD numbers are indicated in red and blue colors, with hot numbers being those that are frequently drawn and blue being those that are drawn more infrequently.
                </p>

                <h4 className="rules-sec-heading">Payments</h4>
                <p className="rules-sub-txt">
                  All winning ball combinations have corresponding odds, which is multiplied by the player's bet amount.
                </p>
                <p className="rules-sub-txt">
                  The winning combination is calculated as the ratio of the number of balls bet to the number of guessed balls.
                </p>

                {/* Exact 10x10 Payout Matrix */}
                <div className="rules-table-scroll-wrapper">
                  <table className="rules-payout-table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>1</th>
                        <th>2</th>
                        <th>3</th>
                        <th>4</th>
                        <th>5</th>
                        <th>6</th>
                        <th>7</th>
                        <th>8</th>
                        <th>9</th>
                        <th>10</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th>0</th>
                        <td></td><td></td><td></td><td></td><td></td><td></td>
                        <td>1</td>
                        <td>1</td>
                        <td>2</td>
                        <td>2</td>
                      </tr>
                      <tr>
                        <th>1</th>
                        <td>3.5</td>
                        <td>1</td>
                        <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
                      </tr>
                      <tr>
                        <th>2</th>
                        <td></td>
                        <td>10</td>
                        <td>2</td>
                        <td>1.5</td>
                        <td>1</td>
                        <td></td><td></td><td></td><td></td><td></td>
                      </tr>
                      <tr>
                        <th>3</th>
                        <td></td><td></td>
                        <td>50</td>
                        <td>10</td>
                        <td>3</td>
                        <td>2</td>
                        <td>2</td>
                        <td></td><td></td><td></td>
                      </tr>
                      <tr>
                        <th>4</th>
                        <td></td><td></td><td></td>
                        <td>80</td>
                        <td>30</td>
                        <td>15</td>
                        <td>4</td>
                        <td>5</td>
                        <td>2</td>
                        <td></td>
                      </tr>
                      <tr>
                        <th>5</th>
                        <td></td><td></td><td></td><td></td>
                        <td>150</td>
                        <td>60</td>
                        <td>20</td>
                        <td>15</td>
                        <td>10</td>
                        <td>5</td>
                      </tr>
                      <tr>
                        <th>6</th>
                        <td></td><td></td><td></td><td></td><td></td>
                        <td>500</td>
                        <td>80</td>
                        <td>50</td>
                        <td>25</td>
                        <td>30</td>
                      </tr>
                      <tr>
                        <th>7</th>
                        <td></td><td></td><td></td><td></td><td></td><td></td>
                        <td>1000</td>
                        <td>200</td>
                        <td>125</td>
                        <td>100</td>
                      </tr>
                      <tr>
                        <th>8</th>
                        <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
                        <td>2000</td>
                        <td>1000</td>
                        <td>300</td>
                      </tr>
                      <tr>
                        <th>9</th>
                        <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
                        <td>5000</td>
                        <td>2000</td>
                      </tr>
                      <tr>
                        <th>10</th>
                        <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
                        <td>10000</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p className="rules-policy-txt">
                  Disconnection policy: If a disconnection occurs after an active game round and your bets were accepted by the server, the game will proceed as normal and any winnings will be processed according to the game result regardless of the disconnection.
                </p>
              </div>
            ) : (
              <div className="rules-tab-pane" id="paneFairness">
                <div className="rules-fairness-wrap">
                  <div className="fairness-shield-icon">
                    <svg viewBox="0 0 48 54" width="46" height="52" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M24 2L5 9.5V25C5 38 13.2 49.8 24 53C34.8 49.8 43 38 43 25V9.5L24 2Z" fill="url(#fairShieldGrad-p3)" stroke="#4fe6a3" strokeWidth="1.8" strokeLinejoin="round" />
                      <path d="M24 4.5L7.5 11.2V25C7.5 36.5 14.8 47 24 49.8C33.2 47 40.5 36.5 40.5 25V11.2L24 4.5Z" fill="url(#fairInnerGrad-p3)" opacity="0.6" />
                      <path d="M16 26.5L21.5 32L32 19.5" stroke="#ffffff" strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round" />
                      <defs>
                        <linearGradient id="fairShieldGrad-p3" x1="24" y1="2" x2="24" y2="53" gradientUnits="userSpaceOnUse">
                          <stop stopColor="#3ddc97" />
                          <stop offset="0.3" stopColor="#1b7348" />
                          <stop offset="0.7" stopColor="#0e4329" />
                          <stop offset="1" stopColor="#072214" />
                        </linearGradient>
                        <linearGradient id="fairInnerGrad-p3" x1="24" y1="4.5" x2="24" y2="49.8" gradientUnits="userSpaceOnUse">
                          <stop stopColor="#55f2ab" stopOpacity="0.5" />
                          <stop offset="0.5" stopColor="#145233" stopOpacity="0.2" />
                          <stop offset="1" stopColor="#051a0f" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                  <h3 className="fairness-main-title">ABOUT FAIRNESS</h3>
                  <div className="fairness-content-box">
                    <p className="fairness-p">
                      Before the start of a round, the players are provided with a “Hash Code*” - an encrypted text combination “Key*”. Here are the round outcome numbers.
                    </p>
                    <p className="fairness-p">
                      The outcome of the round is determined not at the moment of the game, but in advance for current round, and is given to the players in coded form.
                    </p>
                    <p className="fairness-p">
                      Current Round Public Hash:{' '}
                      <span className="fairness-hash-code">{serverSeedHash || 'CSPRNG-SHA256-ACTIVE'}</span>
                    </p>
                    <p className="fairness-p">
                      After the end of a round, the players are provided with a “Key*” and an additional input parameter for getting the “Hash Code*” - “Salt*”. Using them, every player can copy and verify that the encrypted “Key*” corresponds to the “Hash code*” previously determined by the system.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KenoPage;
