const PREFIX = "https://www.pernarovskyi.pl";

const req = (url, options = {}) => {
  const { body } = options;
  return fetch((PREFIX + url).replace(/\/\/$/, ""), {
    ...options,
    body: body ? JSON.stringify(body) : null,
    headers: {
      ...options.headers,
      ...(body
        ? {
          "Content-Type": "application/json",
        }
        : null),
    },
  }).then((res) =>
    res.ok
      ? res.json()
      : res.text().then((message) => {
        throw new Error(message);
      })
  );
};

export const getNotes = ({ age, search, page } = {}) => {
  const queryParams = new URLSearchParams({
    ...(age && { age }),
    ...(search && { search }),
    ...(page && { page }),
  });
  return req(`/api/notes?${queryParams.toString()}`);

};

export const createNote = (title, text) => {
  return req(`/api/notes`, {
    method: "POST",
    body: { title, text },
  });
};

export const getNote = (id) => {
  return req(`/api/notes/note/${id}`)
};

export const archiveNote = (id) => {
  return req(`/api/notes/note-archive/${id}`, {
    method: "PUT"
  });
};

export const unarchiveNote = (id) => {
  return req(`/api/notes/note-unarchive/${id}`, {
    method: "PUT"
  });
};

export const editNote = (id, title, text) => {
  return req(`/api/notes/note/${id}`, {
    method: "PATCH",
    body: { title, text },
  });
};

export const deleteNote = (id) => {
  return req(`/api/notes/note/${id}`, {
    method: "DELETE",
  })
};

export const deleteAllArchived = () => {
  return req(`/api/notes/note-archive/deleteAll`, {
    method: "DELETE",
  });
};

export const notePdfUrl = (id) => {
  return `/api/notes/note-to-pdf/${id}`
};
