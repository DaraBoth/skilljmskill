// Meanings for gen-schema.mjs: what each table, field and index is for, in both languages.
export default {
  documents: {
    about: { ko: '시스템 지도 문서 하나예요.', en: 'One system map document.' },
    fields: {
      id: { ko: '문서 id 예요.', en: 'The document id.' },
      slug: { ko: '파일 이름에 쓰는 짧은 이름이에요.', en: 'The short name used in file names.' },
      rev: { ko: '문서가 설명하는 커밋이에요.', en: 'The commit the document describes.' },
      created_at: { ko: '처음 만든 때예요.', en: 'When it was first made.' },
      updated_at: { ko: '마지막으로 다시 빌드한 때예요.', en: 'When it was last rebuilt.' },
    },
    indexes: {
      documents_pkey: { ko: 'id 로 문서를 바로 찾아요.', en: 'Finds a document by id.' },
      documents_slug_key: { ko: '같은 이름의 문서가 둘이 될 수 없어요.', en: 'Two documents cannot share a slug.' },
    },
  },
  diagrams: {
    about: { ko: '문서 안의 그림 하나예요.', en: 'One diagram inside a document.' },
    fields: {
      id: { ko: '그림 id 예요.', en: 'The diagram id.' },
      document_id: { ko: '이 그림이 들어 있는 문서예요.', en: 'The document this diagram belongs to.' },
      name: { ko: 'map-data.mjs 의 키예요.', en: 'Its key in map-data.mjs.' },
      kind: { ko: '그리는 방식이에요.', en: 'How it is laid out.' },
    },
    indexes: {
      diagrams_pkey: { ko: 'id 로 그림을 바로 찾아요.', en: 'Finds a diagram by id.' },
      diagrams_document_name: { ko: '한 문서 안에서 그림 이름은 겹칠 수 없어요.', en: 'Diagram names cannot repeat within one document.' },
    },
  },
};
