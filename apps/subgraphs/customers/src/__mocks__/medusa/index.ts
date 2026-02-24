export const mockMedusa = {
  store: {
    product: {
      list: jest.fn(),
      retrieve: jest.fn(),
    },
    category: {
      list: jest.fn(),
      retrieve: jest.fn(),
    },
    collection: {
      list: jest.fn(),
      retrieve: jest.fn(),
    },
    customer: {
      list: jest.fn(),
      retrieve: jest.fn(),
      create: jest.fn(),
    },
  },
  auth: {
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
  },
  client: {
    setToken: jest.fn(),
  },
};
